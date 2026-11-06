import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

function previewOf(image) {
  return image?.thumbnail_url || image?.optimized_url || image?.url;
}

export function optimizeUrl(id) {
  return id ? `/api/v1/images/${id}?variant=optimized` : null;
}

export function ImageUploader({ value, onChange, label = 'Main image', hint }) {
  const { notify } = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      notify('Image exceeds the 8 MB limit', 'error');
      return;
    }
    setBusy(true);
    try {
      const res = await api.upload('/images', file);
      onChange({ id: res.image.id, preview: previewOf(res.image) }, res.image);
      notify('Image uploaded', 'success');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="field">
      <label>{label}</label>
      {value?.preview ? (
        <div className="upload-preview">
          <img src={value.preview} alt="" />
          <button type="button" className="remove" onClick={() => onChange(null)} aria-label="Remove image">
            ×
          </button>
        </div>
      ) : (
        <div
          className="upload-box"
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click();
          }}
        >
          <strong>{busy ? 'Uploading…' : 'Upload image'}</strong>
          <div className="small">{hint || 'JPG, PNG, WebP or GIF · max 8 MB · min 200×150'}</div>
        </div>
      )}
      <input ref={inputRef} type="file" accept={ACCEPT} onChange={pick} hidden />
    </div>
  );
}

export function GalleryUploader({ items, onChange, max = 8 }) {
  const { notify } = useToast();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const room = max - items.length;
    if (room <= 0) {
      notify(`You can attach up to ${max} gallery images`, 'error');
      return;
    }
    setBusy(true);
    const next = [...items];
    for (const file of files.slice(0, room)) {
      if (file.size > 8 * 1024 * 1024) {
        notify(`${file.name} exceeds the 8 MB limit`, 'error');
        continue;
      }
      try {
        const res = await api.upload('/images', file);
        next.push({ id: res.image.id, preview: previewOf(res.image) });
      } catch (err) {
        notify(`${file.name}: ${err.message}`, 'error');
      }
    }
    onChange(next);
    setBusy(false);
  };

  return (
    <div className="field">
      <label>Gallery images</label>
      {items.length ? (
        <div className="gallery-grid">
          {items.map((item) => (
            <div className="upload-preview" key={item.id}>
              <img src={item.preview} alt="" />
              <button
                type="button"
                className="remove"
                onClick={() => onChange(items.filter((x) => x.id !== item.id))}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="upload-actions">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy || items.length >= max}
        >
          {busy ? 'Uploading…' : `Add images (${items.length}/${max})`}
        </button>
      </div>
      <input ref={inputRef} type="file" accept={ACCEPT} multiple onChange={pick} hidden />
    </div>
  );
}
