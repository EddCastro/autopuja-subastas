/* =====================================================================
   AutoPuja — Esquema SQL Server (REFERENCIA)
   La API lo crea automáticamente al iniciar (npm run db:migrar).
   Generado desde backend/src/db/esquema.js
   ===================================================================== */

IF OBJECT_ID(N'[dbo].[Usuarios]', N'U') IS NULL
CREATE TABLE [dbo].[Usuarios] (
    UsuarioID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Nombre         NVARCHAR(80)  NOT NULL,
    Apellido       NVARCHAR(80)  NOT NULL,
    Correo         NVARCHAR(150) NOT NULL UNIQUE,
    Telefono       VARCHAR(20)   NOT NULL,
    PasswordHash   VARCHAR(100)  NOT NULL,
    FechaRegistro  DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'[dbo].[TiposArticulo]', N'U') IS NULL
CREATE TABLE [dbo].[TiposArticulo] (TipoArticuloID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(50) NOT NULL UNIQUE);
GO

IF OBJECT_ID(N'[dbo].[Marcas]', N'U') IS NULL
CREATE TABLE [dbo].[Marcas] (MarcaID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(50) NOT NULL UNIQUE);
GO

IF OBJECT_ID(N'[dbo].[Combustibles]', N'U') IS NULL
CREATE TABLE [dbo].[Combustibles] (CombustibleID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(40) NOT NULL UNIQUE);
GO

IF OBJECT_ID(N'[dbo].[Transmisiones]', N'U') IS NULL
CREATE TABLE [dbo].[Transmisiones] (TransmisionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Nombre NVARCHAR(40) NOT NULL UNIQUE);
GO

IF OBJECT_ID(N'[dbo].[TrenesManejo]', N'U') IS NULL
CREATE TABLE [dbo].[TrenesManejo] (TrenManejoID INT IDENTITY(1,1) NOT NULL PRIMARY KEY, Codigo VARCHAR(5) NOT NULL UNIQUE, Descripcion NVARCHAR(60) NOT NULL);
GO

IF OBJECT_ID(N'[dbo].[NivelesDanio]', N'U') IS NULL
CREATE TABLE [dbo].[NivelesDanio] (
    NivelDanioID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    Codigo       VARCHAR(10)  NOT NULL UNIQUE,
    Nombre       NVARCHAR(20) NOT NULL,
    Descripcion  NVARCHAR(60) NOT NULL,
    ColorHex     CHAR(7)      NOT NULL,
    Orden        TINYINT      NOT NULL
);
GO

IF OBJECT_ID(N'[dbo].[Vehiculos]', N'U') IS NULL
CREATE TABLE [dbo].[Vehiculos] (
    VehiculoID         INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    UsuarioID          INT            NOT NULL REFERENCES [dbo].[Usuarios] (UsuarioID),
    Anio               SMALLINT       NOT NULL CHECK (Anio BETWEEN 1900 AND 2100),
    TipoArticuloID     INT            NOT NULL REFERENCES [dbo].[TiposArticulo] (TipoArticuloID),
    MarcaID            INT            NOT NULL REFERENCES [dbo].[Marcas] (MarcaID),
    Modelo             NVARCHAR(80)   NOT NULL,
    Motor              NVARCHAR(80)   NOT NULL,
    TransmisionID      INT            NOT NULL REFERENCES [dbo].[Transmisiones] (TransmisionID),
    CombustibleID      INT            NOT NULL REFERENCES [dbo].[Combustibles] (CombustibleID),
    TrenManejoID       INT            NOT NULL REFERENCES [dbo].[TrenesManejo] (TrenManejoID),
    Cilindros          TINYINT        NOT NULL,
    NivelDanioID       INT            NOT NULL REFERENCES [dbo].[NivelesDanio] (NivelDanioID),
    Color              NVARCHAR(40)   NULL,
    Kilometraje        INT            NULL,
    Descripcion        NVARCHAR(1000) NULL,
    PrecioBase         DECIMAL(12,2)  NOT NULL CHECK (PrecioBase > 0),
    FechaInicio        DATETIME2(3)   NOT NULL,
    FechaCierre        DATETIME2(3)   NOT NULL,
    MontoActual        DECIMAL(12,2)  NULL,
    TotalPujas         INT            NOT NULL DEFAULT 0,
    LiderUsuarioID     INT            NULL REFERENCES [dbo].[Usuarios] (UsuarioID),
    Resultado          VARCHAR(10)    NULL CHECK (Resultado IN ('VENDIDA', 'DESIERTA')),
    FechaCierreReal    DATETIME2(3)   NULL,
    EsDemo             BIT            NOT NULL DEFAULT 0,
    FechaCreacion      DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    FechaActualizacion DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME(),
    CHECK (FechaCierre > FechaInicio)
);
GO

IF OBJECT_ID(N'[dbo].[Fotos]', N'U') IS NULL
CREATE TABLE [dbo].[Fotos] (
    FotoID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehiculoID  INT            NOT NULL REFERENCES [dbo].[Vehiculos] (VehiculoID) ON DELETE CASCADE,
    Orden       TINYINT        NOT NULL,
    TipoMime    VARCHAR(40)    NOT NULL,
    Datos       VARBINARY(MAX) NOT NULL,
    Tamano      INT            NOT NULL,
    FechaCarga  DATETIME2(3)   NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF OBJECT_ID(N'[dbo].[Pujas]', N'U') IS NULL
CREATE TABLE [dbo].[Pujas] (
    PujaID      INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    VehiculoID  INT           NOT NULL REFERENCES [dbo].[Vehiculos] (VehiculoID) ON DELETE CASCADE,
    UsuarioID   INT           NOT NULL REFERENCES [dbo].[Usuarios] (UsuarioID),
    Monto       DECIMAL(12,2) NOT NULL CHECK (Monto > 0),
    Fecha       DATETIME2(3)  NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vehiculos_Cierre' AND object_id = OBJECT_ID(N'[dbo].[Vehiculos]'))
CREATE INDEX IX_Vehiculos_Cierre ON [dbo].[Vehiculos] (FechaCierre) INCLUDE (FechaInicio, Resultado);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Vehiculos_Usuario' AND object_id = OBJECT_ID(N'[dbo].[Vehiculos]'))
CREATE INDEX IX_Vehiculos_Usuario ON [dbo].[Vehiculos] (UsuarioID);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Fotos_Vehiculo' AND object_id = OBJECT_ID(N'[dbo].[Fotos]'))
CREATE INDEX IX_Fotos_Vehiculo ON [dbo].[Fotos] (VehiculoID, Orden);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pujas_Vehiculo' AND object_id = OBJECT_ID(N'[dbo].[Pujas]'))
CREATE INDEX IX_Pujas_Vehiculo ON [dbo].[Pujas] (VehiculoID, Fecha DESC);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_Pujas_Usuario' AND object_id = OBJECT_ID(N'[dbo].[Pujas]'))
CREATE INDEX IX_Pujas_Usuario ON [dbo].[Pujas] (UsuarioID, VehiculoID);
GO

/* Catálogos base */
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Sedán');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Hatchback');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Coupé');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Convertible');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'SUV');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Pickup');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Van / Minivan');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Camión');
INSERT INTO [dbo].[TiposArticulo] (Nombre) VALUES (N'Motocicleta');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Gasolina');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Diésel');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Híbrido');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Híbrido enchufable');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Eléctrico');
INSERT INTO [dbo].[Combustibles] (Nombre) VALUES (N'Gas LP');
INSERT INTO [dbo].[Transmisiones] (Nombre) VALUES (N'Automática');
INSERT INTO [dbo].[Transmisiones] (Nombre) VALUES (N'Manual');
INSERT INTO [dbo].[Transmisiones] (Nombre) VALUES (N'CVT');
INSERT INTO [dbo].[Transmisiones] (Nombre) VALUES (N'Doble embrague (DCT)');
INSERT INTO [dbo].[TrenesManejo] (Codigo, Descripcion) VALUES ('AWD', N'Tracción integral');
INSERT INTO [dbo].[TrenesManejo] (Codigo, Descripcion) VALUES ('FWD', N'Tracción delantera');
INSERT INTO [dbo].[TrenesManejo] (Codigo, Descripcion) VALUES ('RWD', N'Tracción trasera');
INSERT INTO [dbo].[TrenesManejo] (Codigo, Descripcion) VALUES ('4WD', N'Doble tracción 4x4');
INSERT INTO [dbo].[NivelesDanio] (Codigo, Nombre, Descripcion, ColorHex, Orden) VALUES ('VERDE', N'Verde', N'Daño menor / Limpio', '#16A34A', 1);
INSERT INTO [dbo].[NivelesDanio] (Codigo, Nombre, Descripcion, ColorHex, Orden) VALUES ('AMARILLO', N'Amarillo', N'Daño medio / Reparable', '#EAB308', 2);
INSERT INTO [dbo].[NivelesDanio] (Codigo, Nombre, Descripcion, ColorHex, Orden) VALUES ('ROJO', N'Rojo', N'Daño severo / Salvamento', '#DC2626', 3);
/* Marcas: Acura, Audi, BMW, Buick, Cadillac, Chevrolet, Chrysler, Dodge, Fiat, Ford, GMC, Harley-Davidson, Honda, Hyundai, Infiniti, Isuzu, Jaguar, Jeep, Kawasaki, Kia, Land Rover, Lexus, Lincoln, Mazda, Mercedes-Benz, Mini, Mitsubishi, Nissan, Porsche, Ram, Subaru, Suzuki, Tesla, Toyota, Volkswagen, Volvo, Yamaha */
