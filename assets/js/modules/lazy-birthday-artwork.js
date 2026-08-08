export function createLazyBirthdayArtworkShare({ getBirthdays, toast, modalController }) {
  if (typeof getBirthdays !== 'function') {
    throw new TypeError('createLazyBirthdayArtworkShare requer getBirthdays().');
  }
  if (typeof toast !== 'function') {
    throw new TypeError('createLazyBirthdayArtworkShare requer toast().');
  }

  let controllerPromise = null;
  return async personId => {
    if (!controllerPromise) {
      controllerPromise = import('./birthday-artwork.js?v=6.44.1')
        .then(({ createBirthdayArtworkController }) => createBirthdayArtworkController({ getBirthdays, toast, modalController }))
        .catch(error => {
          controllerPromise = null;
          throw error;
        });
    }
    const controller = await controllerPromise;
    return controller.share(personId);
  };
}
