window.initDataTable = function () {
    const table = document.getElementById('datatablesSimple');

    if (table) {
        const dt = new simpleDatatables.DataTable(table);

        // Depois que o DataTable reconstruir o DOM
        setTimeout(() => {
            const newTbody = table.querySelector('tbody');
            if (newTbody) newTbody.id = "records-body";
        }, 0);
    }
};