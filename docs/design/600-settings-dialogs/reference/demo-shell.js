/* Demo navigation belongs to the gallery, not to the production settings form. */
const forms = new Map();
const selector = document.querySelector('#demo-form-select');
const gallery = document.querySelector('#launch-screen');
const list = document.querySelector('#demo-form-list');
let activeForm = null;
let switching = false;

export function registerDemoForm(form) {
  if (forms.has(form.id)) throw new Error(`Duplicate demo form: ${form.id}`);
  forms.set(form.id, form);
  const option = new Option(form.title, form.id);
  selector.add(option);

  const card = document.createElement('article');
  card.className = 'demo-form-card';
  const heading = document.createElement('h2');
  heading.textContent = form.title;
  const description = document.createElement('p');
  description.textContent = form.description;
  const button = document.createElement('button');
  button.className = 'button primary';
  button.type = 'button';
  button.textContent = 'Open preview';
  button.setAttribute('aria-label', `Open ${form.title} preview`);
  button.addEventListener('click', () => openDemoForm(form.id));
  card.append(heading, description);
  if (form.galleryControls) {
    form.galleryControls.hidden = false;
    card.append(form.galleryControls);
  }
  card.append(button);
  list.append(card);
}

export async function openDemoForm(id) {
  if (switching || id === activeForm) return;
  if (id && !forms.has(id)) throw new Error(`Unknown demo form: ${id}`);
  // Keep showing the current selection until the form agrees to close.
  selector.value = activeForm || '';
  switching = true;
  try {
    if (activeForm && !(await forms.get(activeForm).requestClose())) return;
    if (!id) return;
    activeForm = id;
    selector.value = id;
    gallery.hidden = true;
    document.body.dataset.demoForm = id;
    document.title = `${forms.get(id).title} · House Plan previews`;
    forms.get(id).open();
  } finally {
    switching = false;
  }
}

export function notifyDemoFormClosed(id) {
  if (activeForm !== id) return;
  activeForm = null;
  selector.value = '';
  gallery.hidden = false;
  delete document.body.dataset.demoForm;
  document.title = 'Form previews · House Plan';
  selector.focus({preventScroll:true});
}

selector.addEventListener('change', () => openDemoForm(selector.value));
