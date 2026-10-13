export function escapeHTML(text) {
    if (text == null) return '';
    
    const map = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[<>&"']/g, function(match) {
        return map[match];
    });
}
