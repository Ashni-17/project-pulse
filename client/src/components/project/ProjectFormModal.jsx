import { useState } from 'react';
import { api } from '../../lib/api.js';
import { Field, Modal, Spinner } from '../ui';
import { useToast } from '../../context/ToastContext.jsx';

/** Creates a project, or edits/deletes one when `project` is provided. */
export default function ProjectFormModal({ project, onClose, onSaved, onDeleted }) {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body = { name, description };
      const { project: saved } = project ? await api.patch(`/projects/${project.id}`, body) : await api.post('/projects', body);
      toast.success(project ? 'Project updated' : 'Project created');
      onSaved(saved);
    } catch (err) { setErrors(err.details); toast.error(err.message); } finally { setBusy(false); }
  }

  async function remove() {
    setBusy(true);
    try { await api.del(`/projects/${project.id}`); toast.success('Project deleted'); onDeleted(); }
    catch (err) { toast.error(err.message); setBusy(false); }
  }

  return (
    <Modal title={project ? 'Project settings' : 'New project'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Project name" error={errors.name?.[0]}><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product Launch" maxLength={120} /></Field>
        <Field label="Description" hint="Optional. What is this project for?"><textarea className="input min-h-[80px]" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} /></Field>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy}>{busy && <Spinner className="!text-white" />}{project ? 'Save changes' : 'Create project'}</button>
        </div>
      </form>
      {project && (
        <div className="mt-6 rounded-lg border border-rose-200 bg-rose-50 p-4">
          <h3 className="text-sm font-bold text-rose-800">Delete this project</h3>
          <p className="mt-1 text-sm text-rose-700">All tasks, comments and history are permanently removed. Type <strong>{project.name}</strong> to confirm.</p>
          <div className="mt-3 flex gap-2">
            <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type the project name to confirm" />
            <button className="btn btn-danger shrink-0" disabled={confirm !== project.name || busy} onClick={remove}>Delete</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
