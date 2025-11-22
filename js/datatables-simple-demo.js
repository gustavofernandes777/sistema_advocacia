window.initDataTable = function () {
    const table = document.getElementById('datatablesSimple');
    if (table) {
        new simpleDatatables.DataTable(table);
    }
};