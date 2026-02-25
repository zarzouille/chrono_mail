document.getElementById('countdown-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const endDate = document.getElementById('end-date').value;
    const bgColor = encodeURIComponent(document.getElementById('bg-color').value);
    const textColor = encodeURIComponent(document.getElementById('text-color').value);
    const fontSize = document.getElementById('font-size').value;

    // Générer l'URL de l'image dynamique
    const imageUrl = `http://localhost:3000/generate-countdown?endDate=${endDate}&bgColor=${bgColor}&textColor=${textColor}&fontSize=${fontSize}`;

    // Afficher l'aperçu
    document.getElementById('preview').innerHTML = `<img src="${imageUrl}" alt="Aperçu du countdown" />`;

    // Afficher le code HTML à copier
    document.getElementById('result').innerHTML = `
        <p>Copiez ce code dans votre email :</p>
        <pre>&lt;img src="${imageUrl}" alt="Compte à rebours" /&gt;</pre>
    `;
});