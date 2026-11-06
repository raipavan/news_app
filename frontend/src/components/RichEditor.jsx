import { useEffect, useRef, useState } from 'react';
import { api, thumbnailUrl } from '../lib/api';
import { useToast } from '../context/ToastContext';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
const MAX_BYTES = 8 * 1024 * 1024;

const BUTTONS = [
  { cmd: 'bold', label: 'B', title: 'Bold', style: { fontWeight: 800 } },
  { cmd: 'italic', label: 'I', title: 'Italic', style: { fontStyle: 'italic' } },
  { cmd: 'underline', label: 'U', title: 'Underline', style: { textDecoration: 'underline' } },
  { cmd: 'strikeThrough', label: 'S', title: 'Strikethrough', style: { textDecoration: 'line-through' } },
  { type: 'divider' },
  { cmd: 'formatBlock', value: 'H2', label: 'H2', title: 'Heading 2' },
  { cmd: 'formatBlock', value: 'H3', label: 'H3', title: 'Heading 3' },
  { cmd: 'formatBlock', value: 'P', label: '¶', title: 'Paragraph' },
  { cmd: 'formatBlock', value: 'BLOCKQUOTE', label: '❝', title: 'Quote' },
  { type: 'divider' },
  { cmd: 'insertUnorderedList', label: '• List', title: 'Bulleted list' },
  { cmd: 'insertOrderedList', label: '1. List', title: 'Numbered list' },
  { type: 'divider' },
  { cmd: 'justifyLeft', label: '←', title: 'Align text left' },
  { cmd: 'justifyCenter', label: '↔', title: 'Align text center' },
  { cmd: 'justifyRight', label: '→', title: 'Align text right' },
  { cmd: 'justifyFull', label: '☰', title: 'Justify text' },
  { type: 'divider' },
  { type: 'link', label: 'Link', title: 'Insert link (Ctrl+K)' },
  { cmd: 'insertHorizontalRule', label: '―', title: 'Divider line' },
  { cmd: 'removeFormat', label: 'Clear', title: 'Clear formatting' },
  { cmd: 'undo', label: '↺', title: 'Undo' },
  { cmd: 'redo', label: '↻', title: 'Redo' },
];

const ALIGNMENTS = [
  ['left', 'Left'],
  ['center', 'Center'],
  ['right', 'Right'],
  ['full', 'Full'],
];

function escapeAttr(value) {
  return String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);
}

function figureMarkup(imageId) {
  const src = thumbnailUrl(imageId, 'optimized');
  return `<figure style="width:100%;margin:0 0 18px"><img src="${escapeAttr(src)}" alt=""></figure>`;
}

function figureStyle(align, width) {
  if (align === 'left') return `width:${width}%;float:left;margin:0 18px 14px 0`;
  if (align === 'right') return `width:${width}%;float:right;margin:0 0 14px 18px`;
  if (align === 'center') return `width:${width}%;margin:0 auto 18px`;
  return 'width:100%;margin:0 0 18px';
}

function readFigureState(figure) {
  const width = Number.parseInt(figure.style.width, 10) || 100;
  if (figure.style.float === 'left') return { align: 'left', width };
  if (figure.style.float === 'right') return { align: 'right', width };
  if (/auto/.test(figure.style.margin || '')) return { align: 'center', width };
  return { align: 'full', width: 100 };
}

export default function RichEditor({
  value,
  onChange,
  placeholder,
  language = 'en',
  readOnly = false,
  library = [],
}) {
  const { notify } = useToast();
  const ref = useRef(null);
  const fileRef = useRef(null);
  const savedRange = useRef(null);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);
  const [caption, setCaption] = useState('');
  const [imageState, setImageState] = useState({ align: 'full', width: 100 });
  const [showLibrary, setShowLibrary] = useState(false);

  const readContent = () => {
    const el = ref.current;
    if (!el) return '';
    const marked = Array.from(el.querySelectorAll('figure.selected'));
    marked.forEach((figure) => figure.classList.remove('selected'));
    const html = el.innerHTML;
    marked.forEach((figure) => figure.classList.add('selected'));
    return html;
  };

  useEffect(() => {
    if (ref.current && readContent() !== (value || '')) {
      ref.current.innerHTML = value || '';
      setSelected(null);
      setCaption('');
      setShowLibrary(false);
    }
  }, [value]);

  useEffect(() => {
    if (!selected) return undefined;
    selected.classList.add('selected');
    return () => selected.classList.remove('selected');
  }, [selected]);

  const rememberSelection = () => {
    const el = ref.current;
    const selection = window.getSelection();
    if (!el || !selection || !selection.rangeCount) {
      savedRange.current = null;
      return;
    }
    const range = selection.getRangeAt(0);
    savedRange.current = el.contains(range.commonAncestorContainer) ? range.cloneRange() : null;
  };

  const restoreSelection = () => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const selection = window.getSelection();
    if (!selection) return;
    selection.removeAllRanges();
    const range = savedRange.current;
    if (range && el.contains(range.commonAncestorContainer)) {
      selection.addRange(range);
      return;
    }
    const end = document.createRange();
    end.selectNodeContents(el);
    end.collapse(false);
    selection.addRange(end);
  };

  const insertHtml = (html) => {
    const el = ref.current;
    if (!el) return;
    restoreSelection();
    if (!document.execCommand('insertHTML', false, html)) {
      el.insertAdjacentHTML('beforeend', html);
    }
    onChange(readContent());
  };

  const insertFiles = async (files) => {
    if (busy) return;
    const valid = Array.from(files).filter((file) => {
      if (!ACCEPT.split(',').includes(file.type)) {
        notify('Use JPG, PNG, WebP or GIF photos', 'error');
        return false;
      }
      if (file.size > MAX_BYTES) {
        notify(`${file.name} is larger than 8 MB`, 'error');
        return false;
      }
      return true;
    });
    if (!valid.length) return;

    setBusy(true);
    const ids = [];
    for (const file of valid) {
      try {
        const res = await api.upload('/images', file);
        ids.push(res.image.id);
      } catch (err) {
        notify(`${file.name}: ${err.message}`, 'error');
      }
    }
    setBusy(false);
    if (!ids.length) return;
    insertHtml(`${ids.map((id) => figureMarkup(id)).join('')}<p><br></p>`);
    notify(
      ids.length > 1 ? `Placed ${ids.length} photos in the story` : 'Photo placed in the story',
      'success'
    );
  };

  const choosePhoto = () => {
    rememberSelection();
    fileRef.current?.click();
  };

  const onFileInput = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length) insertFiles(files);
  };

  const insertLink = () => {
    rememberSelection();
    const raw = window.prompt('Link URL (https://…)');
    if (!raw) return;
    const url = raw.trim();
    if (!/^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(url)) {
      notify('Use a full https:// address, mailto:, tel: or a /path link.', 'error');
      return;
    }
    restoreSelection();
    document.execCommand('createLink', false, url);
    onChange(readContent());
  };

  const run = (button) => {
    if (!ref.current) return;
    if (button.type === 'link') {
      insertLink();
      return;
    }
    ref.current.focus();
    document.execCommand(button.cmd, false, button.value || null);
    onChange(readContent());
  };

  const selectFigure = (figure) => {
    if (!figure) {
      setSelected(null);
      setCaption('');
      return;
    }
    setSelected(figure);
    setCaption(figure.querySelector('figcaption')?.textContent || '');
    setImageState(readFigureState(figure));
  };

  const handleClick = (event) => {
    if (readOnly) return;
    const figure = event.target.closest?.('figure');
    if (figure && ref.current?.contains(figure)) selectFigure(figure);
    else selectFigure(null);
  };

  const handleInput = () => {
    if (readOnly) return;
    if (selected && !selected.isConnected) {
      setSelected(null);
      setCaption('');
    } else if (selected) {
      setCaption(selected.querySelector('figcaption')?.textContent || '');
    }
    onChange(readContent());
  };

  const handlePaste = (event) => {
    if (readOnly) return;
    const files = Array.from(event.clipboardData?.files || []).filter((file) =>
      file.type.startsWith('image/')
    );
    if (!files.length) return;
    event.preventDefault();
    rememberSelection();
    insertFiles(files);
  };

  const handleDrop = (event) => {
    if (readOnly) return;
    const files = Array.from(event.dataTransfer?.files || []).filter((file) =>
      file.type.startsWith('image/')
    );
    if (!files.length) return;
    event.preventDefault();
    const caret = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    if (caret && ref.current?.contains(caret.commonAncestorContainer)) {
      savedRange.current = caret;
    } else {
      rememberSelection();
    }
    insertFiles(files);
  };

  const handleDragOver = (event) => {
    if (readOnly) return;
    if (Array.from(event.dataTransfer?.types || []).includes('Files')) event.preventDefault();
  };

  const handleKeyDown = (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      insertLink();
    }
  };

  const applyFigure = (align, width) => {
    if (!selected) return;
    selected.setAttribute('style', figureStyle(align, width));
    setImageState({ align, width });
    onChange(readContent());
  };

  const chooseAlign = (align) => {
    const width = align === 'full' ? 100 : imageState.width < 100 ? imageState.width : 50;
    applyFigure(align, width);
  };

  const chooseWidth = (width) => {
    const align = imageState.align === 'full' && width < 100 ? 'center' : imageState.align;
    applyFigure(align, width);
  };

  const changeCaption = (nextCaption) => {
    setCaption(nextCaption);
    if (!selected) return;
    let captionEl = selected.querySelector('figcaption');
    if (nextCaption.trim()) {
      if (!captionEl) {
        captionEl = document.createElement('figcaption');
        selected.appendChild(captionEl);
      }
      captionEl.textContent = nextCaption;
    } else if (captionEl) {
      captionEl.remove();
    }
    const img = selected.querySelector('img');
    if (img) img.alt = nextCaption.trim();
    onChange(readContent());
  };

  const moveFigure = (direction) => {
    if (!selected) return;
    const sibling = direction < 0 ? selected.previousElementSibling : selected.nextElementSibling;
    if (!sibling) return;
    selected.parentNode.insertBefore(selected, direction < 0 ? sibling : sibling.nextSibling);
    onChange(readContent());
  };

  const removeFigure = () => {
    if (!selected) return;
    selected.remove();
    setSelected(null);
    setCaption('');
    onChange(readContent());
  };

  const toggleLibrary = () => {
    rememberSelection();
    setShowLibrary((open) => !open);
  };

  const insertFromLibrary = (item) => {
    insertHtml(`${figureMarkup(item.id)}<p><br></p>`);
    setShowLibrary(false);
    notify('Photo placed in the story', 'success');
  };

  return (
    <div>
      {!readOnly ? (
        <>
          <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
            {BUTTONS.map((button, index) =>
              button.type === 'divider' ? (
                <span className="divider" key={`divider-${index}`} aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  key={`${button.type || button.cmd}-${button.value || ''}`}
                  title={button.title}
                  style={button.style}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => run(button)}
                >
                  {button.label}
                </button>
              )
            )}
            <span className="divider" aria-hidden="true" />
            <button
              type="button"
              className="toolbar-accent"
              title="Upload a photo and place it at the cursor"
              disabled={busy}
              onMouseDown={(event) => event.preventDefault()}
              onClick={choosePhoto}
            >
              {busy ? 'Uploading…' : 'Image'}
            </button>
            {library.length ? (
              <button
                type="button"
                title="Place a photo from the gallery"
                className={showLibrary ? 'toolbar-active' : ''}
                onMouseDown={(event) => event.preventDefault()}
                onClick={toggleLibrary}
              >
                Gallery
              </button>
            ) : null}
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={onFileInput} />
          </div>

          {selected ? (
            <div className="editor-image-inspector" role="group" aria-label="Selected photo">
              <span className="inspector-label">Photo</span>
              <div className="seg" role="group" aria-label="Photo alignment">
                {ALIGNMENTS.map(([align, label]) => (
                  <button
                    key={align}
                    type="button"
                    className={imageState.align === align ? 'active' : ''}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseAlign(align)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="seg" role="group" aria-label="Photo width">
                {[25, 50, 75, 100].map((width) => (
                  <button
                    key={width}
                    type="button"
                    className={imageState.width === width ? 'active' : ''}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => chooseWidth(width)}
                  >
                    {width}%
                  </button>
                ))}
              </div>
              <input
                value={caption}
                maxLength={300}
                aria-label="Photo caption"
                placeholder="Caption (optional)"
                onChange={(event) => changeCaption(event.target.value)}
              />
              <button
                type="button"
                title="Move photo up"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => moveFigure(-1)}
              >
                ↑
              </button>
              <button
                type="button"
                title="Move photo down"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => moveFigure(1)}
              >
                ↓
              </button>
              <button type="button" onClick={removeFigure}>Remove</button>
              <button type="button" onClick={() => selectFigure(null)}>Done</button>
            </div>
          ) : null}

          {showLibrary && library.length ? (
            <div className="editor-library">
              {library.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title="Place this photo"
                  onClick={() => insertFromLibrary(item)}
                >
                  <img src={item.preview} alt="" />
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}

      <div
        ref={ref}
        className={`editor-content ${language === 'kn' ? 'lang-kn' : ''}`}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-readonly={readOnly || undefined}
        data-placeholder={placeholder || 'Write the story…'}
        onClick={readOnly ? undefined : handleClick}
        onInput={handleInput}
        onBlur={() => !readOnly && onChange(readContent())}
        onPaste={handlePaste}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}
