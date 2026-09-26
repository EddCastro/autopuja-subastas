'use strict';

/** Valores iniciales de los catálogos (se insertan si no existen). */
module.exports = {
  tiposArticulo: ['Sedán', 'Hatchback', 'Coupé', 'Convertible', 'SUV', 'Pickup', 'Van / Minivan', 'Camión', 'Motocicleta'],

  marcas: [
    'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler', 'Dodge', 'Fiat', 'Ford', 'GMC',
    'Harley-Davidson', 'Honda', 'Hyundai', 'Infiniti', 'Isuzu', 'Jaguar', 'Jeep', 'Kawasaki', 'Kia', 'Land Rover',
    'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mini', 'Mitsubishi', 'Nissan', 'Porsche', 'Ram', 'Subaru',
    'Suzuki', 'Tesla', 'Toyota', 'Volkswagen', 'Volvo', 'Yamaha'
  ],

  combustibles: ['Gasolina', 'Diésel', 'Híbrido', 'Híbrido enchufable', 'Eléctrico', 'Gas LP'],

  transmisiones: ['Automática', 'Manual', 'CVT', 'Doble embrague (DCT)'],

  trenesManejo: [
    { codigo: 'AWD', descripcion: 'Tracción integral' },
    { codigo: 'FWD', descripcion: 'Tracción delantera' },
    { codigo: 'RWD', descripcion: 'Tracción trasera' },
    { codigo: '4WD', descripcion: 'Doble tracción 4x4' }
  ],

  nivelesDanio: [
    { codigo: 'VERDE', nombre: 'Verde', descripcion: 'Daño menor / Limpio', color: '#16A34A', orden: 1 },
    { codigo: 'AMARILLO', nombre: 'Amarillo', descripcion: 'Daño medio / Reparable', color: '#EAB308', orden: 2 },
    { codigo: 'ROJO', nombre: 'Rojo', descripcion: 'Daño severo / Salvamento', color: '#DC2626', orden: 3 }
  ],

  // Valores permitidos para el número de cilindros (0 = eléctrico)
  cilindros: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16]
};
