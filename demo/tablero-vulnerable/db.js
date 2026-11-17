// Datos en memoria. Dos empresas (cuentas) que nunca deberían ver lo de la otra.
module.exports = {
  accounts: [
    { id: 1, name: 'Empresa A', credits: 0 },
    { id: 2, name: 'Empresa B', credits: 0 },
  ],
  users: [
    { id: 1, accountId: 1, email: 'ana@empresa-a.test', password: 'demo123', name: 'Ana', role: 'admin' },
    { id: 2, accountId: 1, email: 'luis@empresa-a.test', password: 'demo123', name: 'Luis', role: 'member' },
    { id: 3, accountId: 2, email: 'beto@empresa-b.test', password: 'demo123', name: 'Beto', role: 'admin' },
  ],
  boards: [
    { id: 1, accountId: 1, ownerId: 1, shareId: 1001, title: 'Ventas Q4 Empresa A', cards: ['Cliente grande', 'Descuento 30%'] },
    { id: 2, accountId: 2, ownerId: 3, shareId: 1002, title: 'Nómina Empresa B', cards: ['Sueldos', 'Bonos'] },
  ],
};
