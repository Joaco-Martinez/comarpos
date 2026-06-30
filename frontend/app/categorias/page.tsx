'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import AppLayout from '@/components/AppLayout';
import api from '@/lib/api';
import type { ProductCategory } from '@/types';
import { normalizeArray } from '@/lib/helpers';
import toast from 'react-hot-toast';
import { formatDateAR } from '@/lib/dateAR';
import {
  Tags,
  Plus,
  Search,
  RefreshCcw,
  Edit2,
  Trash2,
  X,
  RotateCcw,
  FolderTree,
  Power,
  PowerOff,
  Package,
  AlertTriangle,
} from 'lucide-react';

type Modal = 'create' | 'edit' | null;

type CategoryForm = {
  name: string;
  description: string;
  isActive: boolean;
};

type ConfirmState = {
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
} | null;

const emptyForm: CategoryForm = {
  name: '',
  description: '',
  isActive: true,
};

const MOBILE_PAGE_SIZE = 8;

function useIsMobile(maxWidth = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= maxWidth);

    check();
    window.addEventListener('resize', check);

    return () => window.removeEventListener('resize', check);
  }, [maxWidth]);

  return isMobile;
}

function formatDate(value?: string) {
  return formatDateAR(value);
}

function productsCount(category: ProductCategory) {
  return Number(category._count?.products ?? 0);
}

function getErrorMessage(error: unknown, fallback: string) {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
}

export default function CategoriasPage() {
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [form, setForm] = useState<CategoryForm>(emptyForm);

  const [confirmModal, setConfirmModal] = useState<ConfirmState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [mobilePage, setMobilePage] = useState(1);
  const [mobileCategorySheet, setMobileCategorySheet] = useState<ProductCategory | null>(null);

  const isMobile = useIsMobile();

  const load = async (showSuccess = false) => {
    setLoading(true);

    try {
      const res = await api.get('/categories?includeInactive=true');
      setCategories(normalizeArray<ProductCategory>(res.data));

      if (showSuccess) {
        toast.success('Categorías actualizadas');
      }
    } catch (e) {
      console.error(e);
      toast.error('Error al cargar categorías');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;

    api
      .get('/categories?includeInactive=true')
      .then((res) => {
        if (!alive) return;
        setCategories(normalizeArray<ProductCategory>(res.data));
      })
      .catch((e) => {
        console.error(e);
        if (!alive) return;
        toast.error('Error al cargar categorías');
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

    return categories.filter((c) => {
      const matchesText =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.slug?.toLowerCase().includes(q) ||
        String(c.description ?? '').toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && c.isActive) ||
        (statusFilter === 'inactive' && !c.isActive);

      return matchesText && matchesStatus;
    });
  }, [categories, search, statusFilter]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).length,
    [categories]
  );

  const inactiveCategories = useMemo(
    () => categories.filter((c) => !c.isActive).length,
    [categories]
  );

  const totalProductsAssociated = useMemo(
    () => categories.reduce((acc, c) => acc + productsCount(c), 0),
    [categories]
  );

  const mobileTotalPages = Math.max(1, Math.ceil(filtered.length / MOBILE_PAGE_SIZE));
  const safeMobilePage = Math.min(mobilePage, mobileTotalPages);
  const mobilePageStart = (safeMobilePage - 1) * MOBILE_PAGE_SIZE;
  const mobileCategories = filtered.slice(mobilePageStart, mobilePageStart + MOBILE_PAGE_SIZE);
  const mobileShowingFrom = filtered.length ? mobilePageStart + 1 : 0;
  const mobileShowingTo = Math.min(mobilePageStart + MOBILE_PAGE_SIZE, filtered.length);

  const resetMobilePage = () => setMobilePage(1);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (category: ProductCategory) => {
    setMobileCategorySheet(null);
    setEditing(category);
    setForm({
      name: category.name ?? '',
      description: category.description ?? '',
      isActive: category.isActive,
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

  const saveCategory = async () => {
    if (!form.name.trim()) {
      toast.error('Ingresá el nombre de la categoría');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        isActive: form.isActive,
      };

      if (modal === 'create') {
        await toast.promise(api.post('/categories', payload), {
          loading: 'Creando categoría...',
          success: 'Categoría creada correctamente',
          error: 'Error al crear categoría',
        });
      }

      if (modal === 'edit' && editing) {
        await toast.promise(api.put(`/categories/${editing.id}`, payload), {
          loading: 'Guardando cambios...',
          success: 'Categoría actualizada correctamente',
          error: 'Error al actualizar categoría',
        });
      }

      forceCloseModal();
      await load();
    } catch (e: unknown) {
      const error = e as { response?: { status?: number; data?: { message?: string } } };

      if (error?.response?.status === 409) {
        toast.error('Ya existe una categoría con ese nombre');
      } else {
        toast.error(error?.response?.data?.message ?? 'Error al guardar categoría');
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category: ProductCategory) => {
    setMobileCategorySheet(null);
    const count = productsCount(category);

    const message =
      count > 0
        ? `La categoría "${category.name}" tiene ${count} producto/s asociados. Se va a desactivar, no eliminar definitivamente. ¿Continuar?`
        : `¿Eliminar definitivamente la categoría "${category.name}"?`;

    setConfirmModal({
      title: count > 0 ? 'Desactivar categoría' : 'Eliminar categoría',
      message,
      confirmText: count > 0 ? 'Desactivar' : 'Eliminar',
      danger: true,
      onConfirm: async () => {
        try {
          await toast.promise(api.delete(`/categories/${category.id}`), {
            loading: count > 0 ? 'Desactivando categoría...' : 'Eliminando categoría...',
            success:
              count > 0
                ? 'Categoría desactivada correctamente'
                : 'Categoría eliminada correctamente',
            error: 'Error al eliminar categoría',
          });

          await load();
        } catch (e: unknown) {
          toast.error(getErrorMessage(e, 'Error al eliminar categoría'));
        }
      },
    });
  };

  const restoreCategory = async (category: ProductCategory) => {
    setMobileCategorySheet(null);
    try {
      await toast.promise(api.patch(`/categories/${category.id}/restore`), {
        loading: 'Restaurando categoría...',
        success: 'Categoría restaurada correctamente',
        error: 'Error al restaurar categoría',
      });

      await load();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Error al restaurar categoría'));
    }
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

  return (
    <AppLayout
      title="Categorías"
      subtitle="Clasificación dinámica para productos, promos y stock"
      actions={
        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: isMobile ? 'wrap' : 'nowrap',
            width: isMobile ? '100%' : 'auto',
          }}
        >


          
        </div>
      }
    >
      <button
        className="btn btn-primary btn-sm categories-mobile-create-btn"
        onClick={openCreate}
        style={{
          flex: isMobile ? '1 1 0' : undefined,
          minWidth: isMobile ? 0 : undefined,
        }}
      >
        <Plus size={14} />
        Nueva categoría
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, 1fr)',
          gap: isMobile ? 10 : 12,
          marginBottom: 18,
        }}
      >
        
        <div className="stat-card">
          <div className="stat-value">{categories.length}</div>
          <div className="stat-label">Categorías</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{activeCategories}</div>
          <div className="stat-label">Activas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{inactiveCategories}</div>
          <div className="stat-label">Inactivas</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{totalProductsAssociated}</div>
          <div className="stat-label">Productos asociados</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 18,
          flexWrap: 'wrap',
          flexDirection: isMobile ? 'column' : 'row',
        }}
      >
        <div
          style={{
            position: 'relative',
            flex: 1,
            minWidth: isMobile ? '100%' : 240,
            width: isMobile ? '100%' : undefined,
          }}
        >
          
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
            onChange={(e) => {
              setSearch(e.target.value);
              resetMobilePage();
            }}
            placeholder={isMobile ? 'Buscar categoría...' : 'Buscar por nombre, slug o descripción...'}
            style={{
              paddingLeft: 34,
              width: '100%',
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
            resetMobilePage();
          }}
          style={{
            width: isMobile ? '100%' : 220,
          }}
        >
          <option value="all">Todos los estados</option>
          <option value="active">Solo activas</option>
          <option value="inactive">Solo inactivas</option>
        </select>

        <button
          className="btn btn-secondary btn-sm"
          onClick={() => load(true)}
          disabled={loading}
          style={{
            width: isMobile ? '100%' : undefined,
            justifyContent: isMobile ? 'center' : undefined,
          }}
        >
          <RefreshCcw size={14} />
          Actualizar
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          {loading ? (
            <div style={{ padding: isMobile ? 14 : 20 }}>
              <div
                className="skeleton"
                style={{
                  height: isMobile ? 360 : 220,
                  borderRadius: 12,
                }}
              />
            </div>
          ) : isMobile ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 12,
              }}
            >
              {mobileCategories.map((category) => {
                const count = productsCount(category);

                return (
                  <article
                    key={category.id}
                    className="categories-mobile-card"
                    onClick={() => setMobileCategorySheet(category)}
                  >
                    <div className="categories-mobile-card-head">
                      <span className="categories-mobile-icon">
                        <Tags size={15} />
                      </span>

                      <div className="categories-mobile-title">
                        <div>
                          <b>{category.name}</b>
                          <span className={`badge ${category.isActive ? 'badge-green' : 'badge-gray'}`}>
                            {category.isActive ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                        </div>

                        <small>
                          {category.slug || `ID ${String(category.id).slice(0, 8)}`}
                        </small>
                      </div>
                    </div>

                    <div className="categories-mobile-meta">
                      <div>
                        <small>Productos</small>
                        <strong>{count}</strong>
                      </div>

                      <div>
                        <small>Creada</small>
                        <strong>{formatDate(category.createdAt)}</strong>
                      </div>
                    </div>

                    <p className="categories-mobile-description">
                      {category.description || 'Sin descripción'}
                    </p>

                    <div className="categories-mobile-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setMobileCategorySheet(category)}
                      >
                        Ver más
                      </button>

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openEdit(category)}
                      >
                        <Edit2 size={13} />
                        Editar
                      </button>
                    </div>
                  </article>
                );
              })}

              {filtered.length > MOBILE_PAGE_SIZE && (
                <div className="categories-mobile-pagination">
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={safeMobilePage === 1}
                    onClick={() => setMobilePage((prev) => Math.max(1, prev - 1))}
                  >
                    Anterior
                  </button>

                  <span>
                    {mobileShowingFrom}-{mobileShowingTo} de {filtered.length}
                  </span>

                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={safeMobilePage === mobileTotalPages}
                    onClick={() => setMobilePage((prev) => Math.min(mobileTotalPages, prev + 1))}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Categoría</th>
                  <th>Slug</th>
                  <th>Descripción</th>
                  <th>Productos</th>
                  <th>Estado</th>
                  <th>Creada</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: 'var(--surface2)',
                            display: 'grid',
                            placeItems: 'center',
                          }}
                        >
                          <Tags size={15} />
                        </span>

                        <div>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{category.name}</div>

                          <div
                            style={{
                              fontFamily: 'var(--mono)',
                              color: 'var(--text3)',
                              fontSize: 11,
                            }}
                          >
                            ID {String(category.id).slice(0, 8)}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span className="badge badge-gray">{category.slug}</span>
                    </td>

                    <td style={{ fontSize: 12, color: 'var(--text2)', maxWidth: 280 }}>
                      {category.description || '—'}
                    </td>

                    <td>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          fontFamily: 'var(--mono)',
                          fontWeight: 800,
                        }}
                      >
                        <Package size={13} />
                        {productsCount(category)}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${category.isActive ? 'badge-green' : 'badge-gray'}`}>
                        {category.isActive ? 'ACTIVA' : 'INACTIVA'}
                      </span>
                    </td>

                    <td
                      style={{
                        fontFamily: 'var(--mono)',
                        color: 'var(--text2)',
                        fontSize: 12,
                      }}
                    >
                      {formatDate(category.createdAt)}
                    </td>

                    <td>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(category)}
                          title="Editar"
                        >
                          <Edit2 size={13} />
                        </button>

                        {!category.isActive && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => restoreCategory(category)}
                            title="Restaurar"
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}

                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => deleteCategory(category)}
                          title="Eliminar o desactivar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {!loading && !filtered.length && (
            <div
              className="empty-state"
              style={{
                padding: isMobile ? '48px 16px' : undefined,
              }}
            >
              <FolderTree size={36} />
              <p>Sin categorías</p>
            </div>
          )}
        </div>
      </div>

      {isMobile && mobileCategorySheet && (
        <div
          className="categories-mobile-sheet-backdrop"
          onClick={() => setMobileCategorySheet(null)}
        >
          <div className="categories-mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="categories-mobile-sheet-handle" />

            <div className="categories-mobile-sheet-header">
              <div>
                <b>{mobileCategorySheet.name}</b>
                <small>{mobileCategorySheet.slug || `ID ${String(mobileCategorySheet.id).slice(0, 8)}`}</small>
              </div>

              <button className="btn btn-ghost btn-sm" onClick={() => setMobileCategorySheet(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="categories-mobile-sheet-body">
              <div className="categories-mobile-sheet-grid">
                <div>
                  <small>Estado</small>
                  <strong>{mobileCategorySheet.isActive ? 'Activa' : 'Inactiva'}</strong>
                </div>

                <div>
                  <small>Productos</small>
                  <strong>{productsCount(mobileCategorySheet)}</strong>
                </div>

                <div>
                  <small>Creada</small>
                  <strong>{formatDate(mobileCategorySheet.createdAt)}</strong>
                </div>

                <div>
                  <small>ID</small>
                  <strong>{String(mobileCategorySheet.id).slice(0, 8)}</strong>
                </div>
              </div>

              <div className="categories-mobile-sheet-box">
                <small>Descripción</small>
                <p>{mobileCategorySheet.description || 'Sin descripción cargada.'}</p>
              </div>
            </div>

            <div className="categories-mobile-sheet-actions">
              <button
                className="btn btn-primary"
                onClick={() => openEdit(mobileCategorySheet)}
              >
                <Edit2 size={15} />
                Editar
              </button>

              {!mobileCategorySheet.isActive && (
                <button
                  className="btn btn-secondary"
                  onClick={() => restoreCategory(mobileCategorySheet)}
                >
                  <RotateCcw size={15} />
                  Restaurar
                </button>
              )}

              <button
                className="btn btn-danger"
                onClick={() => deleteCategory(mobileCategorySheet)}
              >
                <Trash2 size={15} />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'create' || modal === 'edit') && typeof document !== 'undefined' &&
        createPortal(
        <div
          className="modal-overlay categories-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div
            className="modal"
            style={{
              width: isMobile ? 'calc(100vw - 24px)' : undefined,
              maxWidth: isMobile ? 'calc(100vw - 24px)' : undefined,
              maxHeight: isMobile ? 'calc(100vh - 24px)' : undefined,
              overflowY: isMobile ? 'auto' : undefined,
            }}
          >
            <div className="modal-header">
              <b>{modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}</b>

              <button className="btn btn-ghost btn-sm" onClick={closeModal}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Nombre *</label>
                <input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="Ej: Bebidas, Promociones, Repuestos"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción</label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Descripción interna de la categoría"
                />
              </div>

              <div
                className="card"
                style={{
                  padding: 14,
                  display: 'flex',
                  alignItems: isMobile ? 'flex-start' : 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexDirection: isMobile ? 'column' : 'row',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: 'var(--surface2)',
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {form.isActive ? <Power size={15} /> : <PowerOff size={15} />}
                  </span>

                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>Categoría activa</div>
                    <div style={{ color: 'var(--text3)', fontSize: 12, lineHeight: 1.4 }}>
                      Las categorías inactivas no deberían usarse para nuevos productos.
                    </div>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      isActive: e.target.checked,
                    }))
                  }
                  style={{
                    width: 18,
                    height: 18,
                    alignSelf: isMobile ? 'flex-end' : undefined,
                  }}
                />
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                flexDirection: isMobile ? 'column-reverse' : 'row',
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={saving}
                style={{ width: isMobile ? '100%' : undefined }}
              >
                Cancelar
              </button>

              <button
                className="btn btn-primary"
                onClick={saveCategory}
                disabled={saving || !form.name.trim()}
                style={{ width: isMobile ? '100%' : undefined }}
              >
                {saving ? <span className="spinner" /> : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
,
          document.body
        )}


      {confirmModal && typeof document !== 'undefined' &&
        createPortal(
        <div
          className="modal-overlay categories-modal-overlay"
          onClick={(e) => {
            if (confirmLoading) return;
            if (e.target === e.currentTarget) setConfirmModal(null);
          }}
        >
          <div
            className="modal"
            style={{
              maxWidth: isMobile ? 'calc(100vw - 24px)' : 440,
              width: isMobile ? 'calc(100vw - 24px)' : undefined,
            }}
          >
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
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
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

                <p
                  style={{
                    color: 'var(--text2)',
                    fontSize: 13,
                    lineHeight: 1.55,
                    margin: 0,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {confirmModal.message}
                </p>
              </div>
            </div>

            <div
              className="modal-footer"
              style={{
                flexDirection: isMobile ? 'column-reverse' : 'row',
              }}
            >
              <button
                className="btn btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={confirmLoading}
                style={{ width: isMobile ? '100%' : undefined }}
              >
                Cancelar
              </button>

              <button
                className={confirmModal.danger ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={confirmAction}
                disabled={confirmLoading}
                style={{ width: isMobile ? '100%' : undefined }}
              >
                {confirmLoading ? (
                  <span className="spinner" />
                ) : (
                  confirmModal.confirmText ?? 'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
,
          document.body
        )}


      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 10020;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 18px;
          background: rgba(0, 0, 0, 0.52);
          overflow-y: auto;
        }

        .modal {
          margin: auto;
          max-height: calc(100dvh - 36px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-body {
          overflow-y: auto;
        }

        .categories-mobile-create-btn {
          margin-bottom: 14px;
        }

        @media (min-width: 769px) {
          .categories-mobile-create-btn {
            margin-bottom: 0;
          }
        }

        @media (max-width: 768px) {
          .categories-mobile-create-btn {
            width: 100%;
            height: 40px;
            justify-content: center;
            border-radius: 12px;
          }

          .categories-mobile-card {
            border: 1px solid var(--border);
            border-radius: 16px;
            background: var(--surface);
            padding: 11px;
            display: grid;
            gap: 9px;
            min-width: 0;
          }

          .categories-mobile-card-head {
            display: flex;
            align-items: flex-start;
            gap: 10px;
            min-width: 0;
          }

          .categories-mobile-icon {
            width: 34px;
            height: 34px;
            border-radius: 11px;
            background: var(--surface2);
            display: grid;
            place-items: center;
            color: var(--accent);
            flex-shrink: 0;
          }

          .categories-mobile-title {
            min-width: 0;
            flex: 1;
            display: grid;
            gap: 3px;
          }

          .categories-mobile-title > div {
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
          }

          .categories-mobile-title b {
            color: var(--text);
            font-size: 14px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
          }

          .categories-mobile-title .badge {
            flex-shrink: 0;
            font-size: 9px;
            padding: 3px 6px;
          }

          .categories-mobile-title small {
            color: var(--text3);
            font-family: var(--mono);
            font-size: 10.5px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .categories-mobile-meta {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 7px;
          }

          .categories-mobile-meta > div {
            background: var(--bg);
            border-radius: 12px;
            padding: 8px 9px;
            min-width: 0;
          }

          .categories-mobile-meta small {
            display: block;
            color: var(--text3);
            font-size: 10px;
            font-weight: 900;
            margin-bottom: 3px;
          }

          .categories-mobile-meta strong {
            display: block;
            font-family: var(--mono);
            color: var(--text);
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .categories-mobile-description {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.35;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }

          .categories-mobile-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
          }

          .categories-mobile-actions button {
            width: 100%;
            justify-content: center;
            min-height: 33px;
          }

          .categories-mobile-pagination {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 8px;
            align-items: center;
            padding-top: 2px;
          }

          .categories-mobile-pagination button {
            width: 100%;
            justify-content: center;
          }

          .categories-mobile-pagination span {
            color: var(--text3);
            font-size: 11px;
            font-weight: 900;
            white-space: nowrap;
          }

          .categories-mobile-sheet-backdrop {
            position: fixed;
            inset: 0;
            z-index: 10000;
            background: rgba(0, 0, 0, 0.52);
            display: flex;
            align-items: flex-end;
            justify-content: center;
          }

          .categories-mobile-sheet {
            width: 100%;
            max-height: min(82dvh, 620px);
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 22px 22px 0 0;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.38);
          }

          .categories-mobile-sheet-handle {
            width: 44px;
            height: 4px;
            border-radius: 999px;
            background: var(--border);
            margin: 10px auto 8px;
            flex-shrink: 0;
          }

          .categories-mobile-sheet-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 0 14px 12px;
            border-bottom: 1px solid var(--border);
          }

          .categories-mobile-sheet-header b {
            display: block;
            font-size: 15px;
            line-height: 1.2;
            color: var(--text);
            overflow-wrap: anywhere;
          }

          .categories-mobile-sheet-header small {
            display: block;
            color: var(--text3);
            font-family: var(--mono);
            font-size: 11px;
            margin-top: 4px;
          }

          .categories-mobile-sheet-body {
            padding: 12px 14px;
            overflow-y: auto;
            display: grid;
            gap: 10px;
          }

          .categories-mobile-sheet-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }

          .categories-mobile-sheet-grid > div,
          .categories-mobile-sheet-box {
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--surface2);
            padding: 10px;
            min-width: 0;
          }

          .categories-mobile-sheet-grid small,
          .categories-mobile-sheet-box small {
            display: block;
            color: var(--text3);
            font-size: 10px;
            font-weight: 900;
            margin-bottom: 5px;
          }

          .categories-mobile-sheet-grid strong {
            display: block;
            color: var(--text);
            font-family: var(--mono);
            font-size: 12px;
            overflow-wrap: anywhere;
          }

          .categories-mobile-sheet-box p {
            margin: 0;
            color: var(--text2);
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }

          .categories-mobile-sheet-actions {
            display: grid;
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom));
            border-top: 1px solid var(--border);
            background: var(--surface);
          }

          .categories-mobile-sheet-actions button {
            width: 100%;
            justify-content: center;
          }

          .modal-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(88dvh, calc(100dvh - 8px)) !important;
            margin: 0;
            border-radius: 22px 22px 0 0 !important;
            overflow: hidden !important;
            display: flex;
            flex-direction: column;
          }

          .modal-header {
            flex-shrink: 0;
            border-bottom: 1px solid var(--border);
          }

          .modal-body {
            overflow-y: auto;
            padding: 14px !important;
          }

          .modal-footer {
            flex-shrink: 0;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
            border-top: 1px solid var(--border);
          }
        }

        @media (max-width: 420px) {
          .categories-mobile-card {
            border-radius: 14px;
            padding: 10px;
          }

          .categories-mobile-meta {
            grid-template-columns: 1fr 1fr;
          }

          .categories-mobile-sheet-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>


      <style jsx global>{`
        @media (max-width: 768px) {
          body:has(.categories-modal-overlay) {
            overflow: hidden;
          }

          .categories-modal-overlay {
            position: fixed !important;
            inset: 0 !important;
            z-index: 10050 !important;
            display: flex !important;
            align-items: flex-end !important;
            justify-content: center !important;
            padding: 0 !important;
            background: rgba(0, 0, 0, 0.56) !important;
            overflow: hidden !important;
          }

          .categories-modal-overlay .modal {
            width: 100vw !important;
            max-width: 100vw !important;
            max-height: min(88dvh, calc(100dvh - 8px)) !important;
            margin: 0 !important;
            border-radius: 22px 22px 0 0 !important;
            overflow: hidden !important;
            display: flex !important;
            flex-direction: column !important;
            background: var(--surface) !important;
            border: 1px solid var(--border) !important;
            box-shadow: 0 -18px 60px rgba(0, 0, 0, 0.38) !important;
          }

          .categories-modal-overlay .modal-header {
            flex-shrink: 0 !important;
            border-bottom: 1px solid var(--border) !important;
            min-height: 54px !important;
          }

          .categories-modal-overlay .modal-body {
            flex: 1 1 auto !important;
            min-height: 0 !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            padding: 14px !important;
            display: grid !important;
            gap: 12px !important;
          }

          .categories-modal-overlay .modal-footer {
            flex-shrink: 0 !important;
            display: grid !important;
            grid-template-columns: 1fr !important;
            gap: 10px !important;
            padding: 12px 14px calc(12px + env(safe-area-inset-bottom)) !important;
            border-top: 1px solid var(--border) !important;
            background: var(--surface) !important;
          }

          .categories-modal-overlay .modal-footer button,
          .categories-modal-overlay .modal-body button {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>

    </AppLayout>
  );
}