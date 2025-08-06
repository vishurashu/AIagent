 
async function makeLinksClickable(text) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" style="color:#007bff; text-decoration:underline;">${url}</a>`;
  });
}

module.exports = makeLinksClickable;