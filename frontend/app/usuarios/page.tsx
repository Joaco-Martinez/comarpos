'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { ClientCategory, Role, User } from '@/types';
import {
  Plus,
  Edit2,
  Trash2,
  UserCog,
  X,
  Shield,
  Search,
  AlertTriangle,
} from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLEADO',
  isActive: 'true',

  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  category: 'Price',
  creditLimit: '',
  isAccountEnabled: 'false',
};

type UserForm = typeof emptyForm;

const USERS_MOBILE_PAGE_SIZE = 8;

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;

  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string | null;
  category?: ClientCategory;
  creditLimit?: number | null;
  isAccountEnabled?: boolean;
};

type UpdateUserPayload = {
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  password?: string;
};

function normalizeArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (
    value &&
    typeof value === 'object' &&
    'content' in value &&
    Array.isArray((value as { content?: unknown }).content)
  ) {
    return (value as { content: T[] }).content;
  }

  if (
    value &&
    typeof value === 'object' &&
    'users' in value &&
    Array.isArray((value as { users?: unknown }).users)
  ) {
    return (value as { users: T[] }).users;
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.message ??
    (error as { response?: { data?: { message?: string; error?: string } } })?.response?.data
      ?.error ??
    fallback
  );
}

function isBackofficeUser(user: User) {
  return user.role === 'ADMIN' || user.role === 'EMPLEADO';
}

async function fetchUsers() {
  const response = await api.get('/users');
  return normalizeArray<User>(response.data).filter(isBackofficeUser);
}

export default function UsuariosPage() {
  const { user: me } = useAuthStore();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<User | null>(null);

  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<UserForm>(emptyForm);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobileUserSheet, setMobileUserSheet] = useState<User | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const data = await fetchUsers();
      setUsers(data);

      if (showSuccess) {
        toast.success('Usuarios actualizados');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    fetchUsers()
      .then((data) => {
        if (!alive) return;
        setUsers(data);
      })
      .catch((e) => {
        console.error(e);

        if (!alive) return;
        toast.error('Error al cargar usuarios');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    return users.filter((u) => {
      if (!isBackofficeUser(u)) return false;

      return (
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    });
  }, [users, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / USERS_MOBILE_PAGE_SIZE));

  const safeCurrentPage = Math.min(currentPage, totalPages);

  const mobilePaginatedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * USERS_MOBILE_PAGE_SIZE;
    return filtered.slice(start, start + USERS_MOBILE_PAGE_SIZE);
  }, [filtered, safeCurrentPage]);

  const mobilePageStart = filtered.length ? (safeCurrentPage - 1) * USERS_MOBILE_PAGE_SIZE + 1 : 0;
  const mobilePageEnd = Math.min(safeCurrentPage * USERS_MOBILE_PAGE_SIZE, filtered.length);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setEditing(null);
    setModal('create');
  };

  const openEdit = (u: User) => {
    setEditing(u);

    setForm({
      ...emptyForm,
      name: u.name ?? '',
      email: u.email ?? '',
      role: u.role,
      isActive: String(u.isActive !== false),
      password: '',
    });

    setModal('edit');
  };

  const closeModal = () => {
    if (saving) return;

    setModal(null);
    setEditing(null);
    setForm(emptyForm);
  };

  const forceCloseModal = () => {
    setModal(null);
    setEditing(null);
    setForm(emptyForm);
  };

  const field = (key: keyof UserForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };

      if (key === 'role' && value === 'CLIENTE') {
        const [firstName, ...rest] = String(prev.name || '').trim().split(' ');

        next.nombre = prev.nombre || firstName || '';
        next.apellido = prev.apellido || rest.join(' ') || '';
        next.category = prev.category || 'Price';
        next.isAccountEnabled = prev.isAccountEnabled || 'false';
      }

      if (key === 'name' && prev.role === 'CLIENTE') {
        const [firstName, ...rest] = String(value || '').trim().split(' ');

        if (!prev.nombre) next.nombre = firstName || '';
        if (!prev.apellido) next.apellido = rest.join(' ') || '';
      }

      return next;
    });
  };

  const validateForm = () => {
    if (!form.name.trim()) {
      toast.error('Ingresá el nombre completo');
      return false;
    }

    if (!form.email.trim()) {
      toast.error('Ingresá el email');
      return false;
    }

    if (modal === 'create' && !form.password.trim()) {
      toast.error('Ingresá una contraseña');
      return false;
    }

    if (modal === 'create' && form.password.trim().length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return false;
    }

    if (modal === 'create' && form.role === 'CLIENTE') {
      if (!form.nombre.trim()) {
        toast.error('Ingresá el nombre del cliente');
        return false;
      }

      if (!form.apellido.trim()) {
        toast.error('Ingresá el apellido del cliente');
        return false;
      }

      if (!form.dni.trim()) {
        toast.error('Ingresá el DNI/CUIT del cliente');
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);

    const toastId = toast.loading(
      modal === 'create' ? 'Creando usuario...' : 'Guardando usuario...'
    );

    try {
      if (modal === 'create') {
        const role = form.role as Role;

        const payload: CreateUserPayload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role,
          isActive: form.isActive === 'true',
        };

        if (role === 'CLIENTE') {
          payload.nombre = form.nombre.trim();
          payload.apellido = form.apellido.trim();
          payload.dni = form.dni.trim();
          payload.telefono = form.telefono.trim() || null;
          payload.category = form.category as ClientCategory;
          payload.creditLimit = form.creditLimit ? Number(form.creditLimit) : null;
          payload.isAccountEnabled = form.isAccountEnabled === 'true';
        }

        await api.post('/users', payload);
        toast.success('Usuario creado correctamente', { id: toastId });
      }

      if (modal === 'edit' && editing) {
        const payload: UpdateUserPayload = {
          name: form.name.trim(),
          email: form.email.trim().toLowerCase(),
          role: form.role as Role,
          isActive: form.isActive === 'true',
        };

        if (form.password) {
          payload.password = form.password;
        }

        await api.put(`/users/${editing.id}`, payload);
        toast.success('Usuario actualizado correctamente', { id: toastId });
      }

      forceCloseModal();
      await load();
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Error al guardar usuario'), { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (u.id === me?.id) {
      toast.error('No podés eliminarte a vos mismo');
      return;
    }

    setConfirmModal({
      title: 'Eliminar usuario',
      message: `¿Eliminar usuario "${u.name}"?`,
      confirmText: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        const toastId = toast.loading('Eliminando usuario...');

        try {
          await api.delete(`/users/${u.id}`);
          await load();
          toast.success('Usuario eliminado correctamente', { id: toastId });
        } catch (error: unknown) {
          toast.error(getErrorMessage(error, 'No se pudo eliminar el usuario'), {
            id: toastId,
          });
        }
      },
    });
  };

  const confirmAction = async () => {
    if (!confirmModal) return;

    setConfirmLoading(true);

    try {
      await confirmModal.onConfirm();
      setConfirmModal(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (me?.role !== 'ADMIN') {
    return (
      <AppLayout title="Usuarios">
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <Shield
            size={48}
            style={{
              color: 'var(--danger)',
              margin: '0 auto 16px',
              display: 'block',
            }}
          />

          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
            Acceso restringido
          </h2>

          <p style={{ color: 'var(--text2)' }}>
            Solo los administradores pueden gestionar usuarios.
          </p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Usuarios"
      subtitle="Gestión de administradores y empleados"
      actions={
        <div className="users-actions" style={{ display: 'flex', gap: 8 }}>

          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            <Plus size={14} />
            Nuevo usuario
          </button>
        </div>
      }
    >
      <div
        className="users-stats-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Usuarios</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {users.filter((u) => u.role === 'ADMIN').length}
          </div>
          <div className="stat-label">Administradores</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {users.filter((u) => u.role === 'EMPLEADO').length}
          </div>
          <div className="stat-label">Empleados</div>
        </div>
      </div>

      <div className="users-search" style={{ position: 'relative', marginBottom: 18, maxWidth: 480 }}>
        <Search
          size={14}
          style={{
            position: 'absolute',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text3)',
          }}
        />

        <input
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nombre, email, rol, DNI o categoría..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      <div className="card users-card">
        <div className="table-wrap users-desktop-table">
          {loading ? (
            <div style={{ padding: 20 }}>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 44, marginBottom: 8 }}
                />
              ))}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Cliente vinculado</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background:
                              u.role === 'ADMIN'
                                ? 'rgba(15,159,92,0.15)'
                                : 'var(--surface2)',
                            border: `1px solid ${
                              u.role === 'ADMIN'
                                ? 'rgba(15,159,92,0.4)'
                                : 'var(--border)'
                            }`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: 14,
                            color:
                              u.role === 'ADMIN' ? 'var(--accent)' : 'var(--text2)',
                          }}
                        >
                          {u.name?.[0]?.toUpperCase() ?? 'U'}
                        </div>

                        <span style={{ fontWeight: 600, fontSize: 13 }}>
                          {u.name}

                          {u.id === me?.id && (
                            <span
                              style={{
                                fontSize: 10,
                                color: 'var(--text3)',
                                fontFamily: 'var(--mono)',
                                marginLeft: 8,
                              }}
                            >
                              — vos
                            </span>
                          )}
                        </span>
                      </div>
                    </td>

                    <td style={{ color: 'var(--text2)', fontSize: 13 }}>{u.email}</td>

                    <td>
                      <span
                        className={`badge ${
                          u.role === 'ADMIN'
                            ? 'badge-green'
                            : u.role === 'CLIENTE'
                              ? 'badge-blue'
                              : 'badge-gray'
                        }`}
                      >
                        {u.role === 'ADMIN' ? '👑 ' : ''}
                        {u.role}
                      </span>
                    </td>

                    <td style={{ color: 'var(--text2)', fontSize: 12 }}>
                      {u.client ? (
                        <>
                          <b>
                            {u.client.nombre} {u.client.apellido}
                          </b>

                          <div
                            style={{
                              color: 'var(--text3)',
                              fontFamily: 'var(--mono)',
                              marginTop: 2,
                            }}
                          >
                            {u.client.category} · {u.client.dni}
                          </div>
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td>
                      <span
                        className={`badge ${
                          u.isActive === false ? 'badge-gray' : 'badge-green'
                        }`}
                      >
                        {u.isActive === false ? 'INACTIVO' : 'ACTIVO'}
                      </span>
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(u)}
                          style={{ padding: 6 }}
                        >
                          <Edit2 size={13} />
                        </button>

                        {u.id !== me?.id && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDelete(u)}
                            style={{ padding: 6 }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <UserCog size={36} />
              <p>Sin usuarios</p>
            </div>
          )}
        </div>

        <div className="users-mobile-list">
          {loading ? (
            <div style={{ padding: 14 }}>
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="skeleton"
                  style={{ height: 92, marginBottom: 10, borderRadius: 16 }}
                />
              ))}
            </div>
          ) : (
            mobilePaginatedUsers.map((u) => (
              <article className="users-mobile-item" key={u.id}>
                <div className="users-mobile-head">
                  <div className="users-mobile-user">
                    <div
                      className={`users-avatar ${u.role === 'ADMIN' ? 'users-avatar-admin' : ''}`}
                    >
                      {u.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>

                    <div>
                      <h3>
                        {u.name}
                        {u.id === me?.id && <span> vos</span>}
                      </h3>
                      <p>{u.email}</p>
                    </div>
                  </div>

                  <span
                    className={`badge ${
                      u.isActive === false ? 'badge-gray' : 'badge-green'
                    }`}
                  >
                    {u.isActive === false ? 'INACTIVO' : 'ACTIVO'}
                  </span>
                </div>

                <div className="users-mobile-badges">
                  <span
                    className={`badge ${
                      u.role === 'ADMIN'
                        ? 'badge-green'
                        : u.role === 'CLIENTE'
                          ? 'badge-blue'
                          : 'badge-gray'
                    }`}
                  >
                    {u.role === 'ADMIN' ? '👑 ' : ''}
                    {u.role}
                  </span>

                  {u.client && (
                    <span className="badge badge-gray">
                      {u.client.category} · {u.client.dni}
                    </span>
                  )}
                </div>

                {u.client && (
                  <div className="users-mobile-client">
                    <small>Cliente vinculado</small>
                    <strong>
                      {u.client.nombre} {u.client.apellido}
                    </strong>
                  </div>
                )}

                <div className="users-mobile-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setMobileUserSheet(u)}
                  >
                    Ver más
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openEdit(u)}
                  >
                    <Edit2 size={13} />
                    Editar
                  </button>
                </div>
              </article>
            ))
          )}

          {!loading && !filtered.length && (
            <div className="empty-state">
              <UserCog size={36} />
              <p>Sin usuarios</p>
            </div>
          )}
        </div>

        {!loading && filtered.length > USERS_MOBILE_PAGE_SIZE && (
          <div className="users-mobile-pagination">
            <div>
              Mostrando {mobilePageStart} - {mobilePageEnd} de {filtered.length}
            </div>

            <div className="users-mobile-pagination-actions">
              <button
                className="btn btn-secondary btn-sm"
                disabled={safeCurrentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              >
                Anterior
              </button>

              <span>Página {safeCurrentPage} de {totalPages}</span>

              <button
                className="btn btn-secondary btn-sm"
                disabled={safeCurrentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {mobileUserSheet && typeof document !== 'undefined' &&
        createPortal(
          <div className="users-mobile-sheet-backdrop" onClick={() => setMobileUserSheet(null)}>
            <div className="users-mobile-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="users-mobile-sheet-handle" />

              <div className="users-mobile-sheet-header">
                <div className="users-mobile-sheet-user">
                  <div className={`users-avatar ${mobileUserSheet.role === 'ADMIN' ? 'users-avatar-admin' : ''}`}>
                    {mobileUserSheet.name?.[0]?.toUpperCase() ?? 'U'}
                  </div>

                  <div>
                    <b>
                      {mobileUserSheet.name}
                      {mobileUserSheet.id === me?.id && <span> vos</span>}
                    </b>
                    <small>{mobileUserSheet.email}</small>
                  </div>
                </div>

                <button className="btn btn-ghost btn-sm" onClick={() => setMobileUserSheet(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="users-mobile-sheet-body">
                <div className="users-mobile-sheet-grid">
                  <div>
                    <small>Rol</small>
                    <strong>{mobileUserSheet.role}</strong>
                  </div>

                  <div>
                    <small>Estado</small>
                    <strong>{mobileUserSheet.isActive === false ? 'Inactivo' : 'Activo'}</strong>
                  </div>

                  <div>
                    <small>Email</small>
                    <strong>{mobileUserSheet.email}</strong>
                  </div>

                  <div>
                    <small>ID</small>
                    <strong>{mobileUserSheet.id}</strong>
                  </div>
                </div>

                {mobileUserSheet.client ? (
                  <div className="users-mobile-sheet-box">
                    <small>Cliente vinculado</small>
                    <p>
                      <b>{mobileUserSheet.client.nombre} {mobileUserSheet.client.apellido}</b>
                      <span>{mobileUserSheet.client.category} · DNI/CUIT {mobileUserSheet.client.dni}</span>
                    </p>
                  </div>
                ) : (
                  <div className="users-mobile-sheet-box">
                    <small>Cliente vinculado</small>
                    <p>Este usuario no tiene cliente vinculado.</p>
                  </div>
                )}
              </div>

              <div className="users-mobile-sheet-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    const user = mobileUserSheet;
                    setMobileUserSheet(null);
                    openEdit(user);
                  }}
                >
                  <Edit2 size={15} />
                  Editar
                </button>

                {mobileUserSheet.id !== me?.id && (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const user = mobileUserSheet;
                      setMobileUserSheet(null);
                      handleDelete(user);
                    }}
                  >
                    <Trash2 size={15} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {modal && typeof document !== 'undefined' && createPortal(
        (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="modal users-modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <span style={{ fontWeight: 800 }}>
                {modal === 'create' ? 'Nuevo usuario' : 'Editar usuario'}
              </span>

              <button
                className="btn btn-ghost btn-sm"
                onClick={closeModal}
                disabled={saving}
                style={{ padding: 6 }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-row users-form-row">
                <div className="form-group">
                  <label className="form-label">Nombre completo *</label>
                  <input
                    value={form.name ?? ''}
                    onChange={(e) => field('name', e.target.value)}
                    placeholder="Nombre completo"
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input
                    type="email"
                    value={form.email ?? ''}
                    onChange={(e) => field('email', e.target.value)}
                    placeholder="correo@comarpos.com"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="form-row users-form-row">
                <div className="form-group">
                  <label className="form-label">
                    {modal === 'create' ? 'Contraseña *' : 'Nueva contraseña'}
                  </label>
                  <input
                    type="password"
                    value={form.password ?? ''}
                    onChange={(e) => field('password', e.target.value)}
                    placeholder={
                      modal === 'create'
                        ? 'Mínimo 6 caracteres'
                        : 'Dejar vacío para no cambiar'
                    }
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Rol</label>
                  <select
                    value={form.role ?? 'EMPLEADO'}
                    onChange={(e) => field('role', e.target.value)}
                    disabled={saving || (modal === 'edit' && editing?.id === me?.id)}
                  >
                    <option value="EMPLEADO">EMPLEADO</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              {modal === 'edit' && (
                <div className="form-group">
                  <label className="form-label">Estado</label>
                  <select
                    value={form.isActive ?? 'true'}
                    onChange={(e) => field('isActive', e.target.value)}
                    disabled={saving || editing?.id === me?.id}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}

              {modal === 'create' && form.role === 'CLIENTE' && (
                <div className="card" style={{ padding: 14, marginTop: 8 }}>
                  <div style={{ fontWeight: 800, marginBottom: 12 }}>
                    Datos comerciales del cliente
                  </div>

                  <div className="form-row users-form-row">
                    <div className="form-group">
                      <label className="form-label">Nombre *</label>
                      <input
                        value={form.nombre ?? ''}
                        onChange={(e) => field('nombre', e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Apellido *</label>
                      <input
                        value={form.apellido ?? ''}
                        onChange={(e) => field('apellido', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="form-row users-form-row">
                    <div className="form-group">
                      <label className="form-label">DNI/CUIT *</label>
                      <input
                        value={form.dni ?? ''}
                        onChange={(e) => field('dni', e.target.value)}
                        disabled={saving}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Teléfono</label>
                      <input
                        value={form.telefono ?? ''}
                        onChange={(e) => field('telefono', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="form-row users-form-row">
                    <div className="form-group">
                      <label className="form-label">Categoría de precio</label>
                      <select
                        value={form.category ?? 'Price'}
                        onChange={(e) => field('category', e.target.value)}
                        disabled={saving}
                      >
                        <option value="Price">Price / Público</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Mayorista">Mayorista</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Límite de crédito</label>
                      <input
                        type="number"
                        value={form.creditLimit ?? ''}
                        onChange={(e) => field('creditLimit', e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cuenta corriente</label>
                    <select
                      value={form.isAccountEnabled ?? 'false'}
                      onChange={(e) => field('isAccountEnabled', e.target.value)}
                      disabled={saving}
                    >
                      <option value="false">Deshabilitada</option>
                      <option value="true">Habilitada</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer users-modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.name ||
                  !form.email ||
                  (modal === 'create' && !form.password) ||
                  (modal === 'create' &&
                    form.role === 'CLIENTE' &&
                    (!form.nombre || !form.apellido || !form.dni))
                }
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      {confirmModal && typeof document !== 'undefined' && createPortal(
        (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div className="modal users-confirm-modal" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <b>{confirmModal.title}</b>

              <button
                className="btn btn-ghost btn-sm"
                onClick={() => !confirmLoading && setConfirmModal(null)}
                disabled={confirmLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: confirmModal.danger
                      ? 'rgba(239,68,68,0.12)'
                      : 'var(--surface2)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <AlertTriangle
                    size={18}
                    style={{
                      color: confirmModal.danger ? 'var(--danger)' : 'var(--accent)',
                    }}
                  />
                </span>

                <p style={{ color: 'var(--text2)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div className="modal-footer users-modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
              >
                {confirmLoading ? <span className="spinner" /> : confirmModal.confirmText ?? 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}

      <style jsx>{`
        .users-mobile-list {
          display: none;
        }


        .users-mobile-pagination {
          display: none;
        }


        .users-avatar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--surface2);
          border: 1px solid var(--border);
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 14px;
          color: var(--text2);
          flex-shrink: 0;
        }

        .users-avatar-admin {
          background: rgba(15, 159, 92, 0.15);
          border-color: rgba(15, 159, 92, 0.4);
          color: var(--accent);
        }

        @media (max-width: 1024px) {
          .users-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 768px) {
          .users-actions {
            width: 100%;
            display: grid !important;
            grid-template-columns: 1fr;
            gap: 8px !important;
          }

          .users-actions button {
            width: 100%;
            justify-content: center;
          }

          .users-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 8px !important;
            margin-bottom: 10px !important;
          }

          .users-stats-grid .stat-card {
            min-height: 64px;
            padding: 10px !important;
          }

          .users-stats-grid .stat-value {
            font-size: 18px !important;
            line-height: 1.1;
          }

          .users-stats-grid .stat-label {
            font-size: 10px !important;
            line-height: 1.2;
          }

          .users-search {
            max-width: none !important;
            width: 100%;
            margin-bottom: 10px !important;
          }

          .users-search input {
            width: 100%;
            min-height: 36px;
            height: 36px;
            font-size: 13px;
          }

          .users-card {
            border-radius: 18px;
            overflow: hidden;
          }

          .users-desktop-table {
            display: none;
          }

          .users-mobile-list {
            display: grid;
            gap: 8px;
            padding: 10px;
          }

          .users-mobile-item {
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface2);
            padding: 10px;
            display: grid;
            gap: 8px;
            min-width: 0;
          }

          .users-mobile-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            min-width: 0;
          }

          .users-mobile-user {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .users-mobile-user > div:last-child {
            min-width: 0;
          }

          .users-mobile-user h3 {
            font-size: 14px;
            font-weight: 900;
            line-height: 1.25;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .users-mobile-user h3 span {
            font-size: 10px;
            color: var(--text3);
            font-family: var(--mono);
            font-weight: 700;
          }

          .users-mobile-user p {
            margin: 3px 0 0;
            color: var(--text3);
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .users-mobile-badges {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .users-mobile-badges .badge,
          .users-mobile-head > .badge {
            font-size: 9px;
            padding: 3px 6px;
          }

          .users-mobile-client {
            display: grid;
            gap: 3px;
            border-radius: 11px;
            background: var(--bg);
            padding: 8px 9px;
          }

          .users-mobile-client small {
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .users-mobile-client strong {
            color: var(--text2);
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .users-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .users-mobile-actions button {
            width: 100%;
            justify-content: center;
          }


          .users-mobile-pagination {
            display: grid;
            gap: 8px;
            padding: 10px;
            border-top: 1px solid var(--border);
            background: var(--surface);
            text-align: center;
            color: var(--text3);
            font-size: 11px;
            font-weight: 800;
          }

          .users-mobile-pagination-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
          }

          .users-mobile-pagination-actions button {
            width: 100%;
            justify-content: center;
          }

          .users-mobile-pagination-actions span {
            color: var(--text2);
            font-size: 12px;
            font-weight: 900;
          }

          .users-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            background: rgba(0, 0, 0, 0.5);
          }

          .users-mobile-sheet {
            width: 100%;
            max-height: min(82dvh, 620px);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            border-radius: 22px 22px 0 0;
            border: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.38);
          }

          .users-mobile-sheet-handle {
            width: 44px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 8px;
            flex-shrink: 0;
          }

          .users-mobile-sheet-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 0 14px 12px;
            border-bottom: 1px solid var(--border);
          }

          .users-mobile-sheet-user {
            min-width: 0;
            flex: 1;
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .users-mobile-sheet-user b {
            display: block;
            font-size: 14px;
            line-height: 1.2;
            color: var(--text);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .users-mobile-sheet-user b span {
            color: var(--text3);
            font-size: 10px;
            font-family: var(--mono);
          }

          .users-mobile-sheet-user small {
            display: block;
            margin-top: 3px;
            color: var(--text3);
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .users-mobile-sheet-body {
            overflow-y: auto;
            padding: 12px 14px;
            display: grid;
            gap: 10px;
          }

          .users-mobile-sheet-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .users-mobile-sheet-grid > div,
          .users-mobile-sheet-box {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .users-mobile-sheet-grid small,
          .users-mobile-sheet-box small {
            display: block;
            color: var(--text3);
            font-size: 10px;
            font-weight: 800;
            margin-bottom: 5px;
          }

          .users-mobile-sheet-grid strong {
            display: block;
            font-family: var(--mono);
            font-size: 11px;
            color: var(--text);
            overflow-wrap: anywhere;
          }

          .users-mobile-sheet-box p {
            display: grid;
            gap: 4px;
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .users-mobile-sheet-box p span {
            color: var(--text3);
            font-family: var(--mono);
            font-size: 11px;
          }

          .users-mobile-sheet-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .users-mobile-sheet-actions button {
            width: 100%;
            justify-content: center;
          }

          .modal-overlay {
            align-items: flex-end;
            justify-content: center;
            padding: 0;
            overflow: hidden;
          }

          .users-modal,
          .users-confirm-modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(92dvh, calc(100dvh - 8px));
            height: auto;
            overflow: hidden;
            border-radius: 22px 22px 0 0;
            display: flex;
            flex-direction: column;
            margin: 0;
          }

          .users-modal .modal-header,
          .users-confirm-modal .modal-header {
            flex-shrink: 0;
            border-bottom: 1px solid var(--border);
            background: var(--surface);
          }

          .users-modal .modal-body,
          .users-confirm-modal .modal-body {
            flex: 1 1 auto;
            min-height: 0;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding: 12px !important;
          }

          .users-modal .modal-body {
            background: var(--bg);
          }

          .users-modal .form-group,
          .users-modal .form-row,
          .users-modal .card {
            border: 1px solid var(--border);
            border-radius: 15px;
            background: var(--surface);
            padding: 10px;
          }

          .users-modal .form-row .form-group,
          .users-modal .card .form-group,
          .users-modal .card .form-row {
            border: 0;
            border-radius: 0;
            background: transparent;
            padding: 0;
          }

          .users-modal input,
          .users-modal select {
            min-height: 38px;
            font-size: 14px;
          }

          .users-modal-footer {
            flex-shrink: 0;
            border-top: 1px solid var(--border);
            background: var(--surface);
            box-shadow: 0 -12px 30px rgba(0, 0, 0, 0.22);
          }

          .users-form-row {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }

          .users-modal-footer {
            display: grid;
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .users-modal-footer button {
            width: 100%;
            justify-content: center;
          }
        }

        @media (max-width: 420px) {
          .users-mobile-list {
            padding: 10px;
          }

          .users-mobile-item {
            border-radius: 14px;
            padding: 10px;
          }

          .users-mobile-head {
            flex-direction: column;
            align-items: stretch;
          }

          .users-mobile-head > .badge {
            width: fit-content;
          }

          .users-mobile-actions {
            grid-template-columns: 1fr 1fr;
          }

          .users-mobile-sheet-grid,
          .users-mobile-sheet-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </AppLayout>
  );
}