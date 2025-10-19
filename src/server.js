// src/server.js
const app = require('./app');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`������ �������� �� ����� ${PORT}`);
    console.log(`������������ API �������� �� �������: http://localhost:${PORT}/api-docs`);
});
