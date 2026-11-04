function copyText(text) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
  const area = document.createElement('textarea');
  area.value = text;
  area.className = 'sprite';
  document.body.append(area);
  area.select();
  const copied = document.execCommand('copy');
  area.remove();
  return copied ? Promise.resolve() : Promise.reject(new Error('Copy failed'));
}

// Copies the order message as the chosen app opens. Instagram cannot receive it in the link.
function handleOrderChannel(channel) {
  const order = channel.closest('.order');
  copyText(order.dataset.orderMessage)
    .then(() => {
      order.querySelector('.order__status').hidden = false;
    })
    .catch(() => {
      // The note on the sign still tells visitors to mention the toy in their message.
    });
}

// Swaps the main photo on a toy page when a round thumbnail is chosen.
function handleThumb(thumb, event) {
  const main = document.getElementById('toy-main-photo');
  if (!main) return;
  event.preventDefault();
  main.srcset = thumb.dataset.srcset;
  main.src = thumb.dataset.src;
  document.querySelectorAll('.thumb').forEach((other) => other.removeAttribute('aria-current'));
  thumb.setAttribute('aria-current', 'true');
}

document.addEventListener('click', (event) => {
  const channel = event.target.closest('.order__channel');
  if (channel) {
    handleOrderChannel(channel);
    return;
  }
  const thumb = event.target.closest('.thumb');
  if (thumb) handleThumb(thumb, event);
});
