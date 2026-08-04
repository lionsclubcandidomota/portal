export function todayStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function timelineHeading(icon, title, subtitle, count) {
  return `<div class="timeline-heading">
    <div class="timeline-heading-main">
      <span aria-hidden="true">${icon}</span>
      <div>
        <h3>${title}</h3>
        <p>${subtitle}</p>
      </div>
    </div>
    <span class="timeline-count">${count}</span>
  </div>`;
}
