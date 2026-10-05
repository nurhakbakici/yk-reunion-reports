import { translate } from '../i18n';
import { useStore } from '../store';
import { pickFile } from './util';

/** Reads a .json file chosen by the user into the library and reports the result. */
export async function importFromFile(): Promise<void> {
  const file = await pickFile('.json,application/json');
  if (!file) return;
  const { importJson, showToast, lang } = useStore.getState();
  try {
    const count = importJson(await file.text());
    showToast(translate(lang, 'toast.imported', { n: count }));
  } catch {
    showToast(translate(lang, 'toast.importBad'));
  }
}
