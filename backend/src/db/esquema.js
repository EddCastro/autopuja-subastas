'use strict';

/**
 * Esquema de la base de datos (SQL Server). Las sentencias son IDEMPOTENTES:
 * se pueden ejecutar varias veces sin error (solo crean lo que falta).
 *
 * Los nombres de tabla admiten un esquema y un prefijo configurables
 * (DB_SCHEMA / DB_TABLE_PREFIX) por si la base es compartida.
 */
const config = require('../config');

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function crearNombres({ esquema = config.db.esquema, prefijo = config.db.prefijo } = {}) {
  if (!IDENT.test(esquema)) throw new Error(`DB_SCHEMA inválido: ${esquema}`);
  if (prefijo && !IDENT.test(prefijo)) throw new Error(`DB_TABLE_PREFIX inválido: ${prefijo}`);
  const n = (t) => `[${esquema}].[${prefijo}${t}]`;
  return {
    Usuarios: n('Usuarios'),
    TiposArticulo: n('TiposArticulo'),
    Marcas: n('Marcas'),
    Combustibles: n('Combustibles'),
    Transmisiones: n('Transmisiones'),
    TrenesManejo: n('TrenesManejo'),
    NivelesDanio: n('NivelesDanio'),
    Vehiculos: n('Vehiculos'),
    Fotos: n('Fotos'),
    Pujas: n('Pujas')
  };
}

const T = crearNombres();

const siNoExiste = (tabla, ddl) => `IF OBJECT_ID(N'${tabla}', N'U') IS NULL\n${ddl}`;
const indice = (nombre, tabla, definicion) =>
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'${nombre}' AND object_id = OBJECT_ID(N'${tabla}'))\n` +
  `CREATE INDEX ${nombre} ON ${tabla} ${definicion};`;

/** Lista ordenada de sentencias DDL. */
function sentenciasEsquema(t = T) {
  return [
    siNoExiste(
      t.Usuarios,
      `CREATE TABLE ${t.Usuarios} (
    UsuarioID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nombre         NVARCHAR(80)  NOT NULL,
    Apellido       NVARCHAR(80)  NOT NULL,
    Correo         NVARCHAR(150) NOT NULL UNIQUE,
    Telefono       VARCHAR(20)   NOT NULL,
    PasswordHash   VARCHAR(100)  NOT NULL,
    FechaRegistro  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);`
    ),
    siNoExiste(t.TiposArticulo, `CREATE TABLE ${t.TiposArticulo} (TipoArticuloID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(50) NOT NULL UNIQUE);`),
    siNoExiste(t.Marcas, `CREATE TABLE ${t.Marcas} (MarcaID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(50) NOT NULL UNIQUE);`),
    siNoExiste(t.Combustibles, `CREATE TABLE ${t.Combustibles} (CombustibleID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(40) NOT NULL UNIQUE);`),
    siNoExiste(t.Transmisiones, `CREATE TABLE ${t.Transmisiones} (TransmisionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(40) NOT NULL UNIQUE);`),
    siNoExiste(
      t.TrenesManejo,
      `CREATE TABLE ${t.TrenesManejo} (TrenManejoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Codigo VARCHAR(5) NOT NULL UNIQUE, Descripcion NVARCHAR(60) NOT NULL);`
    ),
    siNoExiste(
      t.NivelesDanio,
      `CREATE TABLE ${t.NivelesDanio} (
    NivelDanioID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Codigo       VARCHAR(10)  NOT NULL UNIQUE,
    Nombre       NVARCHAR(20) NOT NULL,
    Descripcion  NVARCHAR(60) NOT NULL,
    ColorHex     CHAR(7)      NOT NULL,
    Orden        TINYINT      NOT NULL
);`
    ),
    siNoExiste(
      t.Vehiculos,
      `CREATE TABLE ${t.Vehiculos} (
    VehiculoID         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UsuarioID          INT            NOT NULL REFERENCES ${t.Usuarios} (UsuarioID),
    Anio               SMALLINT       NOT NULL CHECK (Anio BETWEEN 1900 AND 2100),
    TipoArticuloID     INT            NOT NULL REFERENCES ${t.TiposArticulo} (TipoArticuloID),
    MarcaID            INT            NOT NULL REFERENCES ${t.Marcas} (MarcaID),
    Modelo             NVARCHAR(80)   NOT NULL,
    Motor              NVARCHAR(80)   NOT NULL,
    TransmisionID      INT            NOT NULL REFERENCES ${t.Transmisiones} (TransmisionID),
    CombustibleID      INT            NOT NULL REFERENCES ${t.Combustibles} (CombustibleID),
    TrenManejoID       INT            NOT NULL REFERENCES ${t.TrenesManejo} (TrenManejoID),
    Cilindros          TINYINT        NOT NULL,
    NivelDanioID       INT            NOT NULL REFERENCES ${t.NivelesDanio} (NivelDanioID),
    Color              NVARCHAR(40)   NULL,
    Kilometraje        INT            NULL,
    Descripcion        NVARCHAR(1000) NULL,
    PrecioBase         DECIMAL(12,2)  NOT NULL CHECK (PrecioBase > 0),
    FechaInicio        DATETIME2(3)   NOT NULL,
    FechaCierre        DATETIME2(3)   NOT NULL,
    MontoActual        DECIMAL(12,2)  NULL,
    TotalPujas         INT            NOT NULL DEFAULT 0,
    LiderUsuarioID     INT            NULL REFERENCES ${t.Usuarios} (UsuarioID),
    Resultado          VARCHAR(10)    NULL CHECK (Resultado IN ('VENDIDA', 'DESIERTA')),
    FechaCierreReal    DATETIME2(3)   NULL,
    EsDemo             BIT            NOT NULL DEFAULT 0,
    FechaCreacion      DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK (FechaCierre > FechaInicio)
);`
    ),
    siNoExiste(
      t.Fotos,
      `CREATE TABLE ${t.Fotos} (
    FotoID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehiculoID  INT            NOT NULL REFERENCES ${t.Vehiculos} (VehiculoID) ON DELETE CASCADE,
    Orden       TINYINT        NOT NULL,
    TipoMime    VARCHAR(40)    NOT NULL,
    Datos       VARBINARY(MAX) NOT NULL,
    Tamano      INT            NOT NULL,
    FechaCarga  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);`
    ),
    siNoExiste(
      t.Pujas,
      `CREATE TABLE ${t.Pujas} (
    PujaID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehiculoID  INT           NOT NULL REFERENCES ${t.Vehiculos} (VehiculoID) ON DELETE CASCADE,
    UsuarioID   INT           NOT NULL REFERENCES ${t.Usuarios} (UsuarioID),
    Monto       DECIMAL(12,2) NOT NULL CHECK (Monto > 0),
    Fecha       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);`
    ),
    indice('IX_Vehiculos_Cierre', t.Vehiculos, '(FechaCierre) INCLUDE (FechaInicio, Resultado)'),
    indice('IX_Vehiculos_Usuario', t.Vehiculos, '(UsuarioID)'),
    indice('IX_Fotos_Vehiculo', t.Fotos, '(VehiculoID, Orden)'),
    indice('IX_Pujas_Vehiculo', t.Pujas, '(VehiculoID, Fecha DESC)'),
    indice('IX_Pujas_Usuario', t.Pujas, '(UsuarioID, VehiculoID)')
  ];
}

module.exports = { T, crearNombres, sentenciasEsquema };
