import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  Play,
  Upload,
  MapPin,
  X,
  Camera,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getGreeting, formatRelativeTime, cn } from '../../lib/utils';
import { getSLAStatus } from '../../lib/slaEngine';
import StatusBadge from '../shared/StatusBadge';
import DeptTag from '../shared/DeptTag';
import SeverityBadge from '../shared/SeverityBadge';
import SLATimer from '../shared/SLATimer';
import GlassModal from '../shared/GlassModal';
import LoadingSpinner from '../shared/LoadingSpinner';
import EmptyState from '../shared/EmptyState';
import ConfirmModal from '../shared/ConfirmModal';
import { useComplaintExplorer } from '../../contexts/ComplaintExplorerContext';

const BUCKET = 'complaint-images';

export default function WorkerDashboard() {
  const { user, profile } = useAuth();
  const { openByDept, openByStatusGroup } = useComplaintExplorer();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [acceptTarget, setAcceptTarget] = useState(null);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveFile, setResolveFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const fileRef = useRef(null);

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('complaints')
      .select('*, wards(name)')
      .eq('assigned_to', user.id)
      .in('status', ['assigned', 'in_progress', 'reopened'])
      .order('sla_deadline', { ascending: true });

    if (!error) setTasks(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`worker-tasks-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'complaints',
          filter: `assigned_to=eq.${user.id}`,
        },
        () => fetchTasks()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchTasks]);

  const handleAccept = async () => {
    if (!acceptTarget) return;
    setActionError(null);
    const { error } = await supabase
      .from('complaints')
      .update({ status: 'in_progress' })
      .eq('id', acceptTarget.id);

    if (error) {
      setActionError(error.message);
      return;
    }
    setAcceptTarget(null);
    fetchTasks();
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setUploading(true);
    setActionError(null);

    let closureUrl = resolveTarget.closure_image_url;

    if (resolveFile) {
      const ext = resolveFile.name.split('.').pop() || 'jpg';
      const path = `closures/${resolveTarget.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, resolveFile, { upsert: true, contentType: resolveFile.type });

      if (upErr) {
        setActionError(upErr.message);
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      closureUrl = urlData.publicUrl;
    }

    const { error } = await supabase
      .from('complaints')
      .update({
        status: 'resolved',
        closure_image_url: closureUrl,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', resolveTarget.id);

    setUploading(false);
    if (error) {
      setActionError(error.message);
      return;
    }

    if (resolveNote.trim()) {
      await supabase.from('messages').insert({
        complaint_id: resolveTarget.id,
        sender_id: user.id,
        content: `Resolution note: ${resolveNote.trim()}`,
      });
    }

    setResolveTarget(null);
    setResolveNote('');
    setResolveFile(null);
    fetchTasks();
  };

  const assignedCount = tasks.filter((t) => t.status === 'assigned').length;
  const activeCount = tasks.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <DashboardHeader profile={profile} />
        <div className="flex gap-4">
          <StatPill
            label="New assignments"
            value={assignedCount}
            color="text-accent-amber"
            onClick={() => openByStatusGroup('open')}
          />
          <StatPill
            label="In progress"
            value={activeCount}
            color="text-accent-cyan"
            onClick={() => openByStatusGroup('open')}
          />
        </div>
      </header>

      <section className="rounded-xl border border-border-default bg-bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-accent-cyan" />
            <h2 className="text-lg font-semibold text-text-primary">Assigned Task Queue</h2>
          </div>
          <span className="text-sm text-text-secondary">{tasks.length} active</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="md" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Queue clear"
            description="No assigned tasks right now. New assignments will appear here automatically."
          />
        ) : (
          <ul className="divide-y divide-border-default">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onAccept={() => setAcceptTarget(task)}
                onResolve={() => setResolveTarget(task)}
                onDeptClick={(dept) => openByDept(dept)}
              />
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={!!acceptTarget}
        title="Accept assignment"
        message={`Start work on "${acceptTarget?.description?.slice(0, 80) || 'this task'}"? Status will change to In Progress.`}
        confirmLabel="Accept & start"
        onConfirm={handleAccept}
        onCancel={() => setAcceptTarget(null)}
      />

      {resolveTarget && (
        <ResolveModal
          task={resolveTarget}
          note={resolveNote}
          onNoteChange={setResolveNote}
          file={resolveFile}
          onFileChange={setResolveFile}
          fileRef={fileRef}
          uploading={uploading}
          error={actionError}
          onClose={() => {
            setResolveTarget(null);
            setResolveNote('');
            setResolveFile(null);
            setActionError(null);
          }}
          onSubmit={handleResolve}
        />
      )}
    </div>
  );
}

function DashboardHeader({ profile }) {
  return (
    <div>
      <p className="text-sm text-text-secondary">{getGreeting()},</p>
      <h1 className="text-2xl font-bold text-text-primary">{profile?.name || 'Field Worker'}</h1>
      {profile?.dept && (
        <p className="text-sm text-accent-cyan mt-1">{profile.dept} Department</p>
      )}
    </div>
  );
}

function StatPill({ label, value, color, onClick }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'min-w-[120px] rounded-lg border border-border-default bg-bg-elevated px-4 py-3 text-center transition-colors',
        onClick && 'cursor-pointer hover:border-cyan-400/40 hover:bg-white/[0.06]'
      )}
    >
      <p className={cn('text-2xl font-bold', color)}>{value}</p>
      <p className="mt-0.5 text-xs text-text-secondary">{label}</p>
    </Comp>
  );
}

function TaskRow({ task, onAccept, onResolve, onDeptClick }) {
  const sla = getSLAStatus(task.sla_deadline, task.sla_hours);
  const isAssigned = task.status === 'assigned';

  return (
    <li className="px-5 py-4 hover:bg-bg-hover/50 transition-colors">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0">
          <TaskMeta task={task} sla={sla} onDeptClick={onDeptClick} />
          <p className="text-sm text-text-primary mt-2 line-clamp-2">{task.description}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-text-secondary">
            <MapPin size={12} />
            <span>{task.address || task.wards?.name || 'Location pending'}</span>
            <span className="text-text-hint">·</span>
            <span>{formatRelativeTime(task.created_at)}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          {isAssigned ? (
            <button
              type="button"
              onClick={onAccept}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-cyan px-3 py-2 text-sm font-medium text-bg-base hover:bg-accent-cyan/90 transition-colors"
            >
              <Play size={14} />
              Accept
            </button>
          ) : (
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent-emerald px-3 py-2 text-sm font-medium text-white hover:bg-accent-emerald/90 transition-colors"
            >
              <CheckCircle2 size={14} />
              Mark resolved
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function TaskMeta({ task, sla, onDeptClick }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={task.status} size="sm" />
      <DeptTag
        dept={task.dept}
        size="sm"
        interactive={Boolean(onDeptClick)}
        onClick={onDeptClick}
      />
      <SeverityBadge severity={task.severity} size="sm" showLabel={false} />
      <SLATimer
        sla_deadline={task.sla_deadline}
        sla_hours={task.sla_hours}
        size="sm"
        className={sla.status === 'breached' ? 'text-accent-red' : undefined}
      />
    </div>
  );
}

function ResolveModal({
  task,
  note,
  onNoteChange,
  file,
  onFileChange,
  fileRef,
  uploading,
  error,
  onClose,
  onSubmit,
}) {
  return (
    <GlassModal
      open
      onClose={onClose}
      title="Mark as resolved"
      size="sm"
      footer={
        <ModalFooter
          onClose={onClose}
          onSubmit={onSubmit}
          disabled={!file || uploading}
          uploading={uploading}
        />
      }
    >
      <div className="space-y-4 px-5 py-4">
        <p className="line-clamp-2 text-sm text-text-secondary">{task.description}</p>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">
            Closure photo (required)
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={cn(
              'flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 transition-colors',
              file ? 'border-white/30 bg-white/10' : 'border-white/15 hover:border-white/25'
            )}
          >
            {file ? (
              <>
                <Camera className="h-8 w-8 text-text-primary" />
                <span className="text-sm font-medium text-text-primary">{file.name}</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-text-hint" />
                <span className="text-sm text-text-secondary">Upload proof of resolution</span>
              </>
            )}
          </button>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Resolution notes</label>
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            rows={3}
            placeholder="Describe work completed..."
            className="input-field resize-none"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm text-text-primary">
            {error}
          </p>
        )}
      </div>
    </GlassModal>
  );
}

function ModalFooter({ onClose, onSubmit, disabled, uploading }) {
  return (
    <div className="flex gap-3">
      <button type="button" onClick={onClose} className="btn-secondary flex-1">
        Cancel
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="btn-primary inline-flex flex-1 items-center justify-center gap-2 disabled:opacity-50"
      >
        {uploading ? <LoadingSpinner size="sm" /> : <CheckCircle2 size={16} />}
        Submit resolution
      </button>
    </div>
  );
}
