export function createFileInputsController({
  importInput,
  imageInput,
  confirmation,
  parseImportFile,
  fileToDataUrl,
  onImport,
  onImage,
  toast
}) {
  if (!importInput) throw new TypeError('createFileInputsController requer importInput.');
  if (!imageInput) throw new TypeError('createFileInputsController requer imageInput.');
  if (typeof parseImportFile !== 'function') throw new TypeError('createFileInputsController requer parseImportFile().');
  if (typeof fileToDataUrl !== 'function') throw new TypeError('createFileInputsController requer fileToDataUrl().');
  if (typeof onImport !== 'function') throw new TypeError('createFileInputsController requer onImport().');
  if (typeof onImage !== 'function') throw new TypeError('createFileInputsController requer onImage().');

  let imageTarget = null;
  let bound = false;

  const clearImageTarget = () => {
    imageTarget = null;
  };

  const requestImport = () => {
    importInput.value = '';
    importInput.click();
  };

  const requestImage = target => {
    if (!target) throw new TypeError('Informe o destino da imagem.');
    imageTarget = target;
    imageInput.value = '';
    imageInput.click();
  };

  const handleImport = async event => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const approved = await confirmation?.askConfirmation({
        title: 'Importar cópia de segurança?',
        message: 'A importação substituirá todos os dados atuais do portal neste navegador. Revise o arquivo antes de continuar.',
        icon: '📥',
        confirmText: 'Importar e substituir',
        tone: 'warning'
      });
      if (!approved) return;

      const importedState = await parseImportFile(file);
      await onImport(importedState, file);
    } catch (error) {
      toast?.(error?.message || 'Não foi possível importar o arquivo.');
    } finally {
      event.target.value = '';
    }
  };

  const handleImage = async event => {
    const file = event.target.files?.[0];
    const target = imageTarget;
    if (!file || !target) {
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file, 1600, 0.94);
      await onImage(target, dataUrl, file);
    } catch (error) {
      console.error(error);
      toast?.('Não foi possível processar a imagem.');
    } finally {
      event.target.value = '';
      clearImageTarget();
    }
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    importInput.addEventListener('change', handleImport);
    imageInput.addEventListener('change', handleImage);
  };

  return {
    bind,
    clearImageTarget,
    requestImage,
    requestImport
  };
}
