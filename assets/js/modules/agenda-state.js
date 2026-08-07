export function createAgendaController() {
  let mode = 'list';
  let filter = 'all';
  let quickFilter = 'all';
  let calendarCursor = new Date();

  const reset = () => {
    mode = 'list';
    filter = 'all';
    quickFilter = 'all';
    calendarCursor = new Date();
  };

  return {
    reset,
    get mode() {
      return mode;
    },
    set mode(value) {
      mode = value;
    },
    get filter() {
      return filter;
    },
    set filter(value) {
      filter = value;
    },
    get quickFilter() {
      return quickFilter;
    },
    set quickFilter(value) {
      quickFilter = value;
    },
    get calendarCursor() {
      return calendarCursor;
    },
    set calendarCursor(value) {
      calendarCursor = value;
    }
  };
}
