'use strict';

/**
 * Datos de prueba: 3 usuarios pre-creados y vehículos de ejemplo.
 * Las fotos son de Pexels (licencia libre, https://www.pexels.com/license/)
 * y se descargan UNA vez al ejecutar la semilla; quedan guardadas en la BD.
 * Tiempos relativos al momento de ejecutar la semilla (h = horas, d = días).
 */
const H = 60 * 60 * 1000;
const D = 24 * H;

const usuarios = [
  { clave: 'postor1', nombre: 'Ana', apellido: 'López', correo: 'postor1@autopuja.test', telefono: '5555-0101', password: 'Postor1#2026' },
  { clave: 'postor2', nombre: 'Carlos', apellido: 'Méndez', correo: 'postor2@autopuja.test', telefono: '5555-0202', password: 'Postor2#2026' },
  { clave: 'vendedor', nombre: 'María', apellido: 'Rodas', correo: 'vendedor@autopuja.test', telefono: '5555-0303', password: 'Vendedor#2026' }
];

const pexels = (id) => ({ id, url: `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=1280` });

const vehiculos = [
  {
    propietario: 'vendedor',
    anio: 2020, tipo: 'SUV', marca: 'Jeep', modelo: 'Wrangler Unlimited Sahara', motor: '3.6L V6 Pentastar',
    transmision: 'Automática', combustible: 'Gasolina', tren: '4WD', cilindros: 6, danio: 'VERDE',
    color: 'Gris', kilometraje: 48500,
    descripcion: 'Unidad limpia, sin golpes estructurales. Techo rígido desmontable, rines de aleación y título limpio. Revisada en agencia.',
    precioBase: 185000, inicio: -1 * D, cierre: 5 * D,
    pujas: [['postor1', 185000, -20 * H], ['postor2', 203500, -10 * H]],
    fotos: [17722339, 17722341, 17722340, 17722343, 17722342].map(pexels)
  },
  {
    propietario: 'vendedor',
    anio: 2022, tipo: 'Sedán', marca: 'Tesla', modelo: 'Model 3 Long Range', motor: 'Eléctrico dual (AWD) 346 hp',
    transmision: 'Automática', combustible: 'Eléctrico', tren: 'AWD', cilindros: 0, danio: 'VERDE',
    color: 'Azul', kilometraje: 31200,
    descripcion: 'Batería en excelente estado (92 %), cargador incluido. Pequeños rayones cosméticos en defensa trasera.',
    precioBase: 210000, inicio: -6 * H, cierre: 3 * D,
    pujas: [],
    fotos: [35736787, 35736775, 35736769, 35736777, 35736785, 35736763].map(pexels)
  },
  {
    propietario: 'vendedor',
    anio: 2019, tipo: 'Pickup', marca: 'Ford', modelo: 'F-150 XLT', motor: '3.5L V6 EcoBoost',
    transmision: 'Automática', combustible: 'Gasolina', tren: '4WD', cilindros: 6, danio: 'AMARILLO',
    color: 'Gris', kilometraje: 96000,
    descripcion: 'Golpe lateral en la caja (lado del conductor) y defensa trasera doblada. Motor y transmisión funcionales.',
    precioBase: 145000, inicio: -2 * D, cierre: 30 * H,
    pujas: [['postor1', 150000, -1 * D]],
    fotos: [25851807, 25851841, 25851805, 25851808, 25851806].map(pexels)
  },
  {
    propietario: 'postor1',
    anio: 1999, tipo: 'Hatchback', marca: 'Honda', modelo: 'Civic EK', motor: '1.6L I4 SOHC VTEC',
    transmision: 'Manual', combustible: 'Gasolina', tren: 'FWD', cilindros: 4, danio: 'AMARILLO',
    color: 'Negro', kilometraje: 210000,
    descripcion: 'Abolladura leve y rayones en puerta trasera derecha. Suspensión modificada y rines deportivos.',
    precioBase: 28000, inicio: -3 * D, cierre: 7 * D,
    pujas: [['postor2', 28000, -2 * D], ['vendedor', 31000, -1 * D], ['postor2', 34100, -5 * H]],
    fotos: [13118991, 13118990, 13118992, 13118994, 13118996, 13118999, 13119001].map(pexels)
  },
  {
    propietario: 'vendedor',
    anio: 2017, tipo: 'Coupé', marca: 'Toyota', modelo: '86', motor: '2.0L H4 Bóxer',
    transmision: 'Manual', combustible: 'Gasolina', tren: 'RWD', cilindros: 4, danio: 'ROJO',
    color: 'Blanco', kilometraje: 64000,
    descripcion: 'Impacto frontal: sin defensa, radiador y faros expuestos. Bolsas de aire intactas. Ideal para reconstrucción o piezas (salvamento).',
    precioBase: 45000, inicio: -1 * H, cierre: 1 * D,
    pujas: [],
    fotos: [34351913, 34351911, 34351910, 34351909, 34351912].map(pexels)
  },
  {
    propietario: 'vendedor',
    anio: 2019, tipo: 'Hatchback', marca: 'Honda', modelo: 'Civic Type R', motor: '2.0L I4 Turbo VTEC',
    transmision: 'Manual', combustible: 'Gasolina', tren: 'FWD', cilindros: 4, danio: 'VERDE',
    color: 'Gris', kilometraje: 38000,
    descripcion: 'Un solo dueño, mantenimientos en agencia. Sin reportes de accidentes.',
    precioBase: 260000, inicio: 1 * D, cierre: 6 * D,
    pujas: [],
    fotos: [16475138, 16475137, 16475135, 16475136, 16475139].map(pexels)
  },
  {
    propietario: 'vendedor',
    anio: 2016, tipo: 'Coupé', marca: 'Toyota', modelo: '86 GT', motor: '2.0L H4 Bóxer',
    transmision: 'Automática', combustible: 'Gasolina', tren: 'RWD', cilindros: 4, danio: 'VERDE',
    color: 'Blanco', kilometraje: 52000,
    descripcion: 'Subasta finalizada (ejemplo de subasta vendida).',
    precioBase: 90000, inicio: -8 * D, cierre: -1 * D,
    pujas: [['postor1', 90000, -7 * D], ['postor2', 99000, -5 * D], ['postor1', 110000, -2 * D]],
    fotos: [9272421, 9272418, 9681765, 9681767, 9681786, 9681699, 9681775].map(pexels)
  }
];

module.exports = { usuarios, vehiculos };
