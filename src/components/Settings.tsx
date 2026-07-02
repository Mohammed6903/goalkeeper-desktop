/**
 * Settings screen
 *
 * Sections:
 *   1. Appearance — theme toggle (Mocha / Latte)
 *   2. Gemini — API key management + model name inputs
 *   3. Urgency coefficients — all 13 fields, dirty-aware form, reset to defaults, Tune entry
 *   4. Data — DB location note + legacy import
 */

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Sun, Moon, Key, Brain, Sliders, Database, TrendingUp, RotateCcw, Save, HardDrive, Cloud, Loader2 } from 'lucide-react'
import { useConfig, useSaveConfig } from '../hooks/useGk'
import { defaultUrgencyConfig } from '@core/config'
import type { UrgencyConfig, AppConfig } from '@core/config'
import { TuneSheet } from './panels/TuneSheet'
import { queryClient } from '../lib/queryClient'

// ---------------------------------------------------------------------------
// Coefficient metadata — human labels for all 13 fields
// ---------------------------------------------------------------------------

const COEFF_META: { key: keyof UrgencyConfig; label: string; hint: string }[] = [
  { key: 'due',              label: 'Due-date weight',          hint: 'Points added when a task is due within the horizon' },
  { key: 'due_horizon_days', label: 'Due horizon (days)',        hint: 'How many days ahead counts as "due soon"' },
  { key: 'overdue',         label: 'Overdue penalty',           hint: 'Extra urgency per day a task is past its due date' },
  { key: 'priority_high',   label: 'Priority: High',            hint: 'Urgency bonus for high-priority tasks' },
  { key: 'priority_medium', label: 'Priority: Medium',          hint: 'Urgency bonus for medium-priority tasks' },
  { key: 'priority_low',    label: 'Priority: Low',             hint: 'Urgency bonus for low-priority tasks' },
  { key: 'age',             label: 'Age weight',                hint: 'Urgency increase per day a task has been open' },
  { key: 'age_horizon_days',label: 'Age horizon (days)',         hint: 'Cap on age scoring — tasks older than this max out' },
  { key: 'active',          label: 'Active task bonus',         hint: 'Extra urgency for tasks already in progress' },
  { key: 'blocking',        label: 'Blocking bonus',            hint: 'Urgency boost for tasks that are blocking others' },
  { key: 'blocked',         label: 'Blocked penalty',           hint: 'Urgency reduction for tasks blocked by another' },
  { key: 'tag_next',        label: 'Tag: @next bonus',          hint: 'Urgency boost for tasks tagged @next' },
  { key: 'goal_priority',   label: 'Goal-priority multiplier',  hint: 'Scales urgency by the parent goal\'s priority' },
]

// ---------------------------------------------------------------------------
// Styles — reused across sections
// ---------------------------------------------------------------------------

const sectionCard: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
}

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 700,
  color: 'var(--text)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-dim)',
  fontWeight: 600,
  marginBottom: 4,
  display: 'block',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 7,
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
}

const btnPrimary: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 14px',
  borderRadius: 7,
  border: 'none',
  background: 'var(--accent)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const btnGhost: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '6px 14px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const hintStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-dim)',
  marginTop: 2,
  opacity: 0.75,
}

// ---------------------------------------------------------------------------
// AppearanceSection
// ---------------------------------------------------------------------------

function AppearanceSection() {
  const [isLight, setIsLight] = useState(() =>
    document.documentElement.classList.contains('light'),
  )

  function toggleTheme() {
    const el = document.documentElement
    const next = !el.classList.contains('light')
    el.classList.toggle('light', next)
    setIsLight(next)
  }

  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>
        {isLight ? <Sun size={14} color="var(--ctp-yellow)" /> : <Moon size={14} color="var(--ctp-lavender)" />}
        Appearance
      </h3>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>
          Theme: <strong>{isLight ? 'Latte (light)' : 'Mocha (dark)'}</strong>
        </span>
        <button
          style={{ ...btnGhost, marginLeft: 'auto' }}
          onClick={toggleTheme}
        >
          {isLight ? <Moon size={13} /> : <Sun size={13} />}
          Switch to {isLight ? 'Mocha (dark)' : 'Latte (light)'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GeminiSection
// ---------------------------------------------------------------------------

function GeminiSection({ config, saveConfig }: { config: AppConfig; saveConfig: ReturnType<typeof useSaveConfig> }) {
  const [apiKey, setApiKey] = useState('')
  const [keyStatus, setKeyStatus] = useState<boolean | null>(null)
  const [savingKey, setSavingKey] = useState(false)
  const [model, setModel] = useState(config.gemini.model)
  const [fastModel, setFastModel] = useState(config.gemini.fastModel)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await window.gk.getApiKeyStatus()
      setKeyStatus(status)
    } catch {
      setKeyStatus(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  // Sync model fields when config loads/changes
  useEffect(() => {
    setModel(config.gemini.model)
    setFastModel(config.gemini.fastModel)
  }, [config.gemini.model, config.gemini.fastModel])

  async function handleSaveKey() {
    setSavingKey(true)
    try {
      await window.gk.setApiKey(apiKey)
      toast.success('API key saved to OS keychain')
      setApiKey('')
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingKey(false)
    }
  }

  async function handleClearKey() {
    setSavingKey(true)
    try {
      await window.gk.setApiKey('')
      toast.success('API key cleared')
      setApiKey('')
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSavingKey(false)
    }
  }

  function handleSaveModels() {
    saveConfig.mutate(
      { ...config, gemini: { model: model.trim() || 'gemini-2.5-pro', fastModel: fastModel.trim() || 'gemini-2.5-flash' } },
      {
        onSuccess: () => toast.success('Model settings saved'),
        onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
      },
    )
  }

  const modelsDirty =
    model !== config.gemini.model || fastModel !== config.gemini.fastModel

  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>
        <Key size={14} color="var(--ctp-sapphire)" />
        Gemini (LLM features)
      </h3>

      {/* Key status */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          background: keyStatus
            ? 'color-mix(in srgb, var(--ctp-green) 14%, transparent)'
            : 'color-mix(in srgb, var(--ctp-red) 10%, transparent)',
          color: keyStatus ? 'var(--ctp-green)' : 'var(--ctp-red)',
          border: `1px solid ${keyStatus ? 'color-mix(in srgb, var(--ctp-green) 30%, transparent)' : 'color-mix(in srgb, var(--ctp-red) 25%, transparent)'}`,
          alignSelf: 'flex-start',
        }}
      >
        {keyStatus === null ? '…' : keyStatus ? '✓ Key set' : 'No key — LLM features disabled'}
      </div>

      {/* API key input */}
      <div>
        <label style={labelStyle}>API key</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza…"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && apiKey) void handleSaveKey() }}
          />
          <button
            style={{ ...btnPrimary, opacity: savingKey || !apiKey ? 0.6 : 1, cursor: savingKey || !apiKey ? 'not-allowed' : 'pointer' }}
            disabled={savingKey || !apiKey}
            onClick={() => void handleSaveKey()}
          >
            Save key
          </button>
          <button
            style={{ ...btnGhost, opacity: savingKey ? 0.6 : 1, cursor: savingKey ? 'not-allowed' : 'pointer' }}
            disabled={savingKey}
            onClick={() => void handleClearKey()}
          >
            Clear
          </button>
        </div>
        <p style={hintStyle}>
          Get a key at{' '}
          <span style={{ color: 'var(--ctp-sapphire)' }}>aistudio.google.com</span>
          {' '}— stored encrypted in your OS keychain.
        </p>
      </div>

      {/* Model names */}
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Primary model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={inputStyle}
            placeholder="gemini-2.5-pro"
          />
          <p style={hintStyle}>Used for Groom, Tune, Decompose</p>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Fast model</label>
          <input
            type="text"
            value={fastModel}
            onChange={(e) => setFastModel(e.target.value)}
            style={inputStyle}
            placeholder="gemini-2.5-flash"
          />
          <p style={hintStyle}>Used for What-Now (quick queries)</p>
        </div>
      </div>
      {modelsDirty && (
        <div>
          <button
            style={{ ...btnPrimary, opacity: saveConfig.isPending ? 0.7 : 1, cursor: saveConfig.isPending ? 'not-allowed' : 'pointer' }}
            disabled={saveConfig.isPending}
            onClick={handleSaveModels}
          >
            <Save size={12} />
            Save models
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// UrgencySection
// ---------------------------------------------------------------------------

function UrgencySection({ config, saveConfig }: { config: AppConfig; saveConfig: ReturnType<typeof useSaveConfig> }) {
  // Local form state — keyed by coefficient name, stored as string for input binding
  const [form, setForm] = useState<Record<keyof UrgencyConfig, string>>(() =>
    Object.fromEntries(
      COEFF_META.map(({ key }) => [key, String(config.urgency[key])])
    ) as Record<keyof UrgencyConfig, string>,
  )
  const [tuneOpen, setTuneOpen] = useState(false)

  // Sync when config changes externally (e.g. after Tune accepts a coefficient)
  useEffect(() => {
    setForm(
      Object.fromEntries(
        COEFF_META.map(({ key }) => [key, String(config.urgency[key])])
      ) as Record<keyof UrgencyConfig, string>,
    )
  }, [config.urgency])

  function resetToDefaults() {
    const defaults = defaultUrgencyConfig()
    setForm(
      Object.fromEntries(
        COEFF_META.map(({ key }) => [key, String(defaults[key])])
      ) as Record<keyof UrgencyConfig, string>,
    )
    toast('Reset to defaults — click Save to apply')
  }

  // Dirty: any field differs from the persisted config
  const isDirty = COEFF_META.some(({ key }) => {
    const parsed = parseFloat(form[key])
    return !isNaN(parsed) && parsed !== config.urgency[key]
  })

  function handleSave() {
    const next: Partial<UrgencyConfig> = {}
    for (const { key } of COEFF_META) {
      const parsed = parseFloat(form[key])
      if (isNaN(parsed)) {
        toast.error(`Invalid value for ${key}: "${form[key]}"`)
        return
      }
      next[key] = parsed
    }
    saveConfig.mutate(
      { ...config, urgency: next as UrgencyConfig },
      {
        onSuccess: () => toast.success('Urgency coefficients saved — tasks re-ranked'),
        onError: (err) => toast.error(err instanceof Error ? err.message : String(err)),
      },
    )
  }

  return (
    <>
      <div style={sectionCard}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ ...sectionTitle, flex: 1 }}>
            <Sliders size={14} color="var(--ctp-peach)" />
            Urgency coefficients
          </h3>
          <button
            style={btnGhost}
            onClick={() => setTuneOpen(true)}
          >
            <TrendingUp size={13} color="var(--ctp-peach)" />
            Recalibrate with AI (Tune)…
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
          These coefficients control how tasks are ranked on the Ready board.
          Editing them re-ranks your entire task list immediately upon saving.
        </p>

        {/* Grid of coefficient inputs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px 20px',
          }}
        >
          {COEFF_META.map(({ key, label, hint }) => (
            <div key={key}>
              <label style={labelStyle}>
                {label}{' '}
                <code
                  style={{
                    fontSize: 10,
                    fontFamily: 'monospace',
                    color: 'var(--ctp-peach)',
                    background: 'color-mix(in srgb, var(--ctp-peach) 10%, transparent)',
                    borderRadius: 3,
                    padding: '1px 4px',
                  }}
                >
                  {key}
                </code>
              </label>
              <input
                type="number"
                step="any"
                value={form[key]}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [key]: e.target.value }))
                }
                style={inputStyle}
              />
              <p style={hintStyle}>{hint}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <button
            style={{
              ...btnPrimary,
              opacity: !isDirty || saveConfig.isPending ? 0.5 : 1,
              cursor: !isDirty || saveConfig.isPending ? 'not-allowed' : 'pointer',
            }}
            disabled={!isDirty || saveConfig.isPending}
            onClick={handleSave}
          >
            <Save size={12} />
            Save coefficients
          </button>
          <button style={btnGhost} onClick={resetToDefaults}>
            <RotateCcw size={12} />
            Reset to defaults
          </button>
          {isDirty && (
            <span style={{ fontSize: 11, color: 'var(--ctp-yellow)', marginLeft: 4 }}>
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      <TuneSheet open={tuneOpen} onOpenChange={setTuneOpen} />
    </>
  )
}

// ---------------------------------------------------------------------------
// DataSection
// ---------------------------------------------------------------------------

function DataSection() {
  const [importing, setImporting] = useState(false)

  async function handleImport() {
    setImporting(true)
    try {
      const result = await window.gk.importLegacy()
      if (result === null) {
        toast('No legacy database found — nothing to import.')
      } else {
        toast.success(
          `Imported ${result.goals} goal(s), ${result.projects} project(s), ${result.tasks} task(s)` +
            (result.skipped > 0 ? ` · ${result.skipped} skipped (already exist)` : ''),
        )
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setImporting(false)
    }
  }

  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>
        <Database size={14} color="var(--ctp-teal)" />
        Data
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>Database location</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 7,
          }}
        >
          <HardDrive size={13} color="var(--text-dim)" />
          <span style={{ fontSize: 12, color: 'var(--text-dim)', fontFamily: 'monospace' }}>
            Stored in your app data directory as{' '}
            <code
              style={{
                color: 'var(--ctp-teal)',
                background: 'color-mix(in srgb, var(--ctp-teal) 10%, transparent)',
                borderRadius: 3,
                padding: '1px 5px',
              }}
            >
              goalkeeper.db
            </code>
          </span>
        </div>
        <p style={hintStyle}>
          The exact path is platform-specific (e.g. ~/.config/goalkeeper-desktop/ on Linux,
          ~/Library/Application Support/ on macOS).
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={labelStyle}>Import legacy data</label>
        <p style={hintStyle}>
          Import goals, projects and tasks from an existing GoalKeeper CLI{' '}
          <code
            style={{
              color: 'var(--ctp-teal)',
              background: 'color-mix(in srgb, var(--ctp-teal) 10%, transparent)',
              borderRadius: 3,
              padding: '1px 5px',
            }}
          >
            goalkeeper.db
          </code>
          {' '}found in your home directory or the default CLI data path.
          Existing records are skipped safely.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            style={{
              ...btnGhost,
              opacity: importing ? 0.6 : 1,
              cursor: importing ? 'not-allowed' : 'pointer',
            }}
            disabled={importing}
            onClick={() => void handleImport()}
          >
            {importing ? 'Importing…' : 'Import legacy data…'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CloudBackupSection
// ---------------------------------------------------------------------------

function CloudBackupSection() {
  const [uri, setUri] = useState('')
  const [uriStatus, setUriStatus] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(
    () => localStorage.getItem('gk.lastBackupAt'),
  )
  const [confirmRestore, setConfirmRestore] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await window.gk.getMongoUriStatus()
      setUriStatus(status)
    } catch {
      setUriStatus(false)
    }
  }, [])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  async function handleSaveUri() {
    setSaving(true)
    try {
      await window.gk.setMongoUri(uri)
      toast.success('MongoDB URI saved to OS keychain')
      setUri('')
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleClearUri() {
    setSaving(true)
    try {
      await window.gk.setMongoUri('')
      toast.success('MongoDB URI cleared')
      setUri('')
      await fetchStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    try {
      const ok = await window.gk.testCloud()
      if (ok) {
        toast.success('Connection successful')
      } else {
        toast.error('Connection failed — check your URI')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  async function handleBackup() {
    setBackingUp(true)
    try {
      const result = await window.gk.backupCloud()
      const now = new Date().toISOString()
      localStorage.setItem('gk.lastBackupAt', now)
      setLastBackupAt(now)
      toast.success(
        `Backed up ${result.tasks} task(s), ${result.goals} goal(s), ${result.projects} project(s), ${result.events} event(s)`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBackingUp(false)
    }
  }

  async function handleRestore() {
    setConfirmRestore(false)
    setRestoring(true)
    try {
      const result = await window.gk.restoreCloud()
      await queryClient.invalidateQueries()
      toast.success(
        `Restored ${result.goals} goal(s), ${result.projects} project(s), ${result.tasks} task(s), ${result.events} event(s)` +
          (result.skipped > 0 ? ` · ${result.skipped} skipped (already exist)` : ''),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setRestoring(false)
    }
  }

  function formatLastBackup(iso: string): string {
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <div style={sectionCard}>
      <h3 style={sectionTitle}>
        <Cloud size={14} color="var(--ctp-blue)" />
        Cloud backup (MongoDB)
      </h3>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
        Backs up to a MongoDB database (format-compatible with the GoalKeeper CLI).
        SQLite stays your local source of truth.
      </p>

      {/* URI status badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '5px 12px',
          borderRadius: 99,
          fontSize: 12,
          fontWeight: 600,
          background: uriStatus
            ? 'color-mix(in srgb, var(--ctp-green) 14%, transparent)'
            : 'color-mix(in srgb, var(--ctp-red) 10%, transparent)',
          color: uriStatus ? 'var(--ctp-green)' : 'var(--ctp-red)',
          border: `1px solid ${uriStatus ? 'color-mix(in srgb, var(--ctp-green) 30%, transparent)' : 'color-mix(in srgb, var(--ctp-red) 25%, transparent)'}`,
          alignSelf: 'flex-start',
        }}
      >
        {uriStatus === null ? '…' : uriStatus ? '✓ Connection string saved' : 'No URI — cloud backup disabled'}
      </div>

      {/* URI input */}
      <div>
        <label style={labelStyle}>MongoDB connection string</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="password"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="mongodb+srv://…"
            style={{ ...inputStyle, flex: 1 }}
            onKeyDown={(e) => { if (e.key === 'Enter' && uri) void handleSaveUri() }}
          />
          <button
            style={{ ...btnPrimary, opacity: saving || !uri ? 0.6 : 1, cursor: saving || !uri ? 'not-allowed' : 'pointer' }}
            disabled={saving || !uri}
            onClick={() => void handleSaveUri()}
          >
            Save
          </button>
          <button
            style={{ ...btnGhost, opacity: saving ? 0.6 : 1, cursor: saving ? 'not-allowed' : 'pointer' }}
            disabled={saving}
            onClick={() => void handleClearUri()}
          >
            Clear
          </button>
        </div>
        <p style={hintStyle}>Stored encrypted in your OS keychain.</p>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Test connection */}
        <button
          style={{ ...btnGhost, opacity: !uriStatus || testing ? 0.6 : 1, cursor: !uriStatus || testing ? 'not-allowed' : 'pointer' }}
          disabled={!uriStatus || testing}
          onClick={() => void handleTest()}
        >
          {testing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
          {testing ? 'Testing…' : 'Test connection'}
        </button>

        {/* Back up now */}
        <button
          style={{ ...btnPrimary, opacity: !uriStatus || backingUp ? 0.6 : 1, cursor: !uriStatus || backingUp ? 'not-allowed' : 'pointer' }}
          disabled={!uriStatus || backingUp}
          onClick={() => void handleBackup()}
        >
          {backingUp ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Cloud size={12} />}
          {backingUp ? 'Backing up…' : 'Back up now'}
        </button>

        {/* Restore from cloud */}
        {!confirmRestore ? (
          <button
            style={{ ...btnGhost, opacity: !uriStatus || restoring ? 0.6 : 1, cursor: !uriStatus || restoring ? 'not-allowed' : 'pointer' }}
            disabled={!uriStatus || restoring}
            onClick={() => setConfirmRestore(true)}
          >
            {restoring ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : null}
            {restoring ? 'Restoring…' : 'Restore from cloud'}
          </button>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 12px',
              background: 'color-mix(in srgb, var(--ctp-yellow) 10%, transparent)',
              border: '1px solid color-mix(in srgb, var(--ctp-yellow) 30%, transparent)',
              borderRadius: 7,
              fontSize: 12,
              color: 'var(--text)',
            }}
          >
            <span>Restore merges cloud data into your local tasks (won't delete anything). Continue?</span>
            <button
              style={{ ...btnPrimary, background: 'var(--ctp-yellow)', color: 'var(--bg)' }}
              onClick={() => void handleRestore()}
            >
              Yes, restore
            </button>
            <button style={btnGhost} onClick={() => setConfirmRestore(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Last backup timestamp */}
      {lastBackupAt && (
        <p style={{ ...hintStyle, marginTop: 0 }}>
          Last backup: {formatLastBackup(lastBackupAt)}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Settings (exported)
// ---------------------------------------------------------------------------

export function Settings() {
  const { data: config } = useConfig()
  const saveConfig = useSaveConfig()

  if (!config) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 13,
        }}
      >
        Loading…
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '20px 28px',
        maxWidth: 820,
        width: '100%',
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 4 }}>
        <Brain size={20} color="var(--accent)" />
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
          Settings
        </h1>
      </div>

      <AppearanceSection />
      <GeminiSection config={config} saveConfig={saveConfig} />
      <UrgencySection config={config} saveConfig={saveConfig} />
      <DataSection />
      <CloudBackupSection />
    </div>
  )
}
