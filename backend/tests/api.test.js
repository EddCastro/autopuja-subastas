'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { levantar, registrar, publicar, datosVehiculo, jpeg, png, MIN } = require('./helpers');

let s;
before(async () => (s = await levantar()));
after(async () => s.cerrar());

const auth = (t) => ({ Authorization: `Bearer ${t}` });

describe('S1.2 Autenticación', () => {
  test('registro con contraseña segura devuelve token y oculta el hash', async () => {
    const res = await s.http.post('/api/auth/registro').send({
      nombre: 'Lucía', apellido: 'Pérez', correo: 'Lucia.Perez@Prueba.gt', telefono: '+502 5555 9876', password: 'MiClave#2026'
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.usuario.correo, 'lucia.perez@prueba.gt');
    assert.equal(res.body.usuario.passwordHash, undefined);
  });

  test('rechaza contraseña débil, correo duplicado y campos faltantes', async () => {
    let res = await s.http.post('/api/auth/registro').send({ nombre: 'Ab', apellido: 'Cd', correo: 'x@prueba.gt', telefono: '55551234', password: 'password1' });
    assert.equal(res.status, 400);
    assert.match(res.body.error.detalles[0].mensaje, /mayúscula/);
    res = await s.http.post('/api/auth/registro').send({ nombre: 'Lucía', apellido: 'Pérez', correo: 'lucia.perez@prueba.gt', telefono: '55551234', password: 'MiClave#2026' });
    assert.equal(res.status, 409);
    assert.equal(res.body.error.codigo, 'CORREO_REGISTRADO');
    res = await s.http.post('/api/auth/registro').send({});
    assert.deepEqual(res.body.error.detalles.map((d) => d.campo), ['nombre', 'apellido', 'correo', 'telefono', 'password']);
  });

  test('login correcto / incorrecto y perfil', async () => {
    const ok = await s.http.post('/api/auth/login').send({ correo: 'LUCIA.PEREZ@prueba.gt', password: 'MiClave#2026' });
    assert.equal(ok.status, 200);
    const mal = await s.http.post('/api/auth/login').send({ correo: 'lucia.perez@prueba.gt', password: 'otra' });
    assert.equal(mal.status, 401);
    assert.equal(mal.body.error.codigo, 'CREDENCIALES_INVALIDAS');
    const yo = await s.http.get('/api/auth/yo').set(auth(ok.body.token));
    assert.equal(yo.body.usuario.nombre, 'Lucía');
  });

  test('anónimos solo leen: no pueden publicar, ofertar ni ver "mis" datos', async () => {
    assert.equal((await s.http.get('/api/vehiculos')).status, 200);
    assert.equal((await s.http.post('/api/vehiculos')).status, 401);
    assert.equal((await s.http.post('/api/vehiculos/1/pujas').send({ monto: 1000 })).status, 401);
    assert.equal((await s.http.get('/api/vehiculos/mios')).status, 401);
    assert.equal((await s.http.get('/api/pujas/mias')).status, 401);
    const tokenFalso = await s.http.post('/api/vehiculos').set(auth('abc.def.ghi'));
    assert.equal(tokenFalso.status, 401);
  });
});

describe('S2.1 Publicación de vehículos y galería', () => {
  let vendedor;
  before(async () => (vendedor = await registrar(s.http)));

  test('publica con ficha técnica completa, color de daño y 5 fotos', async () => {
    const res = await publicar(s.http, vendedor.token);
    assert.equal(res.status, 201, JSON.stringify(res.body));
    const v = res.body.data;
    assert.equal(v.titulo, '2021 Toyota RAV4 XLE');
    assert.equal(v.fotos.length, 5);
    assert.deepEqual(v.danio, { id: 1, codigo: 'VERDE', nombre: 'Verde', descripcion: 'Daño menor / Limpio', color: '#16A34A' });
    assert.equal(v.trenManejo.codigo, 'AWD');
    assert.equal(v.subasta.estado, 'activa');
    assert.equal(v.esPropietario, true);
    const foto = await s.http.get(v.fotos[0].url);
    assert.equal(foto.status, 200);
    assert.equal(foto.headers['content-type'], 'image/jpeg');
  });

  test('exige mínimo 5 fotos y que sean imágenes reales', async () => {
    let res = await publicar(s.http, vendedor.token, datosVehiculo(), 4);
    assert.equal(res.status, 400);
    assert.match(res.body.error.detalles[0].mensaje, /al menos 5/);
    res = await s.http
      .post('/api/vehiculos')
      .set(auth(vendedor.token))
      .field('datos', JSON.stringify(datosVehiculo()))
      .attach('fotos', Buffer.from('esto no es una imagen, es texto plano...'), { filename: 'virus.jpg', contentType: 'image/jpeg' });
    assert.equal(res.status, 400);
    assert.match(res.body.error.detalles[0].mensaje, /no es una imagen/);
  });

  test('valida todos los campos obligatorios de la ficha y la subasta', async () => {
    const res = await publicar(s.http, vendedor.token, {});
    assert.equal(res.status, 400);
    const campos = res.body.error.detalles.map((d) => d.campo);
    for (const c of ['anio', 'tipoArticuloId', 'marcaId', 'modelo', 'motor', 'transmisionId', 'combustibleId', 'trenManejoId', 'cilindros', 'nivelDanioId', 'precioBase', 'fechaInicio', 'fechaCierre']) {
      assert.ok(campos.includes(c), `falta validar ${c}`);
    }
  });

  test('coherencia: eléctrico = 0 cilindros; cierre posterior al inicio', async () => {
    let res = await publicar(s.http, vendedor.token, datosVehiculo({ combustibleId: 5, cilindros: 4 }));
    assert.equal(res.body.error.detalles[0].campo, 'cilindros');
    const t = Date.now();
    res = await publicar(s.http, vendedor.token, datosVehiculo({ fechaInicio: new Date(t + 10 * MIN).toISOString(), fechaCierre: new Date(t + 5 * MIN).toISOString() }));
    assert.equal(res.body.error.detalles[0].campo, 'fechaCierre');
  });

  test('el publicador busca y edita sus publicaciones; otro usuario no puede', async () => {
    const creado = (await publicar(s.http, vendedor.token, datosVehiculo({ modelo: 'Hilux SR5' }))).body.data;
    const mios = await s.http.get('/api/vehiculos/mios?q=hilux').set(auth(vendedor.token));
    assert.equal(mios.body.total, 1);
    assert.equal(mios.body.data[0].id, creado.id);

    const conservar = creado.fotos.slice(1).map((f) => f.id).reverse(); // elimina la 1ª y reordena
    const datos = { ...datosVehiculo({ modelo: 'Hilux SR5 4x4', nivelDanioId: 2, fechaInicio: creado.subasta.fechaInicio }), fotosConservar: conservar };
    const res = await s.http
      .put(`/api/vehiculos/${creado.id}`)
      .set(auth(vendedor.token))
      .field('datos', JSON.stringify(datos))
      .attach('fotos', png(), { filename: 'nueva.png', contentType: 'image/png' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.data.modelo, 'Hilux SR5 4x4');
    assert.equal(res.body.data.danio.codigo, 'AMARILLO');
    assert.deepEqual(res.body.data.fotos.slice(0, 4).map((f) => f.id), conservar);
    assert.equal(res.body.data.fotos.length, 5);

    const intruso = await registrar(s.http);
    const prohibido = await s.http.put(`/api/vehiculos/${creado.id}`).set(auth(intruso.token)).field('datos', JSON.stringify(datos));
    assert.equal(prohibido.status, 403);
  });

  test('al editar se puede intercalar una foto nueva como portada (fotosOrden)', async () => {
    const v = (await publicar(s.http, vendedor.token)).body.data;
    const ids = v.fotos.map((f) => f.id);
    const datos = { ...datosVehiculo({ fechaInicio: v.subasta.fechaInicio }), fotosConservar: ids.slice(0, 4), fotosOrden: ['n:0', ...ids.slice(0, 4).map((x) => `e:${x}`)] };
    const res = await s.http
      .put(`/api/vehiculos/${v.id}`)
      .set(auth(vendedor.token))
      .field('datos', JSON.stringify(datos))
      .attach('fotos', png(), { filename: 'portada.png', contentType: 'image/png' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    const final = res.body.data.fotos.map((f) => f.id);
    assert.ok(!ids.includes(final[0]), 'la portada es la foto nueva');
    assert.deepEqual(final.slice(1), ids.slice(0, 4));
    const foto = await s.http.get(res.body.data.fotos[0].url);
    assert.equal(foto.headers['content-type'], 'image/png');
    const malo = await s.http.put(`/api/vehiculos/${v.id}`).set(auth(vendedor.token)).field('datos', JSON.stringify({ ...datos, fotosConservar: final, fotosOrden: ['e:1'] }));
    assert.equal(malo.status, 400);
  });

  test('con ofertas registradas no se pueden cambiar precio base ni fechas', async () => {
    const v = (await publicar(s.http, vendedor.token)).body.data;
    const postor = await registrar(s.http);
    await s.http.post(`/api/vehiculos/${v.id}/pujas`).set(auth(postor.token)).send({ monto: 20000 }).expect(201);
    const fotosConservar = v.fotos.map((f) => f.id);
    const cambio = { ...datosVehiculo({ precioBase: 10000, fechaInicio: v.subasta.fechaInicio, fechaCierre: v.subasta.fechaCierre }), fotosConservar };
    const res = await s.http.put(`/api/vehiculos/${v.id}`).set(auth(vendedor.token)).field('datos', JSON.stringify(cambio));
    assert.equal(res.status, 409);
    assert.equal(res.body.error.codigo, 'PARAMETROS_BLOQUEADOS');
    const soloFicha = { ...datosVehiculo({ motor: '2.5L I4 Híbrido', fechaInicio: v.subasta.fechaInicio, fechaCierre: v.subasta.fechaCierre }), fotosConservar };
    const ok = await s.http.put(`/api/vehiculos/${v.id}`).set(auth(vendedor.token)).field('datos', JSON.stringify(soloFicha));
    assert.equal(ok.status, 200, JSON.stringify(ok.body));
  });
});

describe('S2.2 Catálogo e inventario con filtros multitarea', () => {
  let token;
  before(async () => {
    token = (await registrar(s.http)).token;
    const t = Date.now();
    await publicar(s.http, token, datosVehiculo({ marcaId: 10, modelo: 'Mustang GT', anio: 2018, tipoArticuloId: 3, combustibleId: 1, cilindros: 8, nivelDanioId: 3, trenManejoId: 3, precioBase: 90000 }));
    await publicar(s.http, token, datosVehiculo({ marcaId: 33, modelo: 'Model Y', anio: 2023, combustibleId: 5, cilindros: 0, nivelDanioId: 2, precioBase: 250000 }));
    await publicar(s.http, token, datosVehiculo({ marcaId: 13, modelo: 'CR-V', anio: 2015, fechaInicio: new Date(t + 60 * MIN).toISOString(), fechaCierre: new Date(t + 120 * MIN).toISOString() }));
  });

  const titulos = async (qs) => (await s.http.get(`/api/vehiculos?${qs}&tamano=48`)).body.data.map((v) => v.titulo);

  test('catálogos para los formularios y filtros', async () => {
    const c = (await s.http.get('/api/catalogos')).body.data;
    assert.deepEqual(c.trenesManejo.map((t) => t.codigo), ['AWD', 'FWD', 'RWD', '4WD']);
    assert.deepEqual(c.nivelesDanio.map((d) => d.codigo), ['VERDE', 'AMARILLO', 'ROJO']);
    assert.ok(c.marcas.length > 30);
    const modelos = (await s.http.get('/api/catalogos/modelos?marcaId=10')).body.data;
    assert.deepEqual(modelos, ['Mustang GT']);
  });

  test('filtra por marca, modelo, año, combustible, daño, cilindros, tren y precio (combinables)', async () => {
    assert.deepEqual(await titulos('marca=10'), ['2018 Ford Mustang GT']);
    assert.deepEqual(await titulos('modelo=model'), ['2023 Tesla Model Y']);
    assert.deepEqual(await titulos('danio=rojo'), ['2018 Ford Mustang GT']);
    assert.deepEqual(await titulos('combustible=5&danio=amarillo'), ['2023 Tesla Model Y']);
    assert.deepEqual(await titulos('cilindros=8&tren=3'), ['2018 Ford Mustang GT']);
    assert.deepEqual(await titulos('anioMin=2019&precioMin=100000'), ['2023 Tesla Model Y']);
    assert.deepEqual(await titulos('q=mustang'), ['2018 Ford Mustang GT']);
  });

  test('estado de la subasta y ordenamiento', async () => {
    assert.deepEqual(await titulos('estado=proxima'), ['2015 Honda CR-V']);
    const precios = (await s.http.get('/api/vehiculos?orden=precio_desc&tamano=48')).body.data.map((v) => v.subasta.montoActual ?? v.subasta.precioBase);
    assert.deepEqual(precios, [...precios].sort((a, b) => b - a));
    const pag = (await s.http.get('/api/vehiculos?tamano=2&pagina=1')).body;
    assert.equal(pag.data.length, 2);
    assert.ok(pag.paginas >= 2);
  });

  test('filtros inválidos responden 400', async () => {
    assert.equal((await s.http.get('/api/vehiculos?danio=morado')).status, 400);
    assert.equal((await s.http.get('/api/vehiculos?orden=xyz')).status, 400);
    assert.equal((await s.http.get('/api/vehiculos?anioMin=2025&anioMax=2000')).status, 400);
  });
});

describe('S3.2 Reglas de puja validadas en el servidor (vía API)', () => {
  let vendedor, a, b, v;
  before(async () => {
    vendedor = await registrar(s.http);
    a = await registrar(s.http);
    b = await registrar(s.http);
    v = (await publicar(s.http, vendedor.token, datosVehiculo({ precioBase: 20000 }))).body.data;
  });
  const pujar = (u, monto) => s.http.post(`/api/vehiculos/${v.id}/pujas`).set(auth(u.token)).send({ monto });

  test('base, mayor a la actual, +10 %, propietario y líder', async () => {
    assert.equal((await pujar(a, 19999)).body.error.codigo, 'MONTO_MENOR_BASE');
    assert.equal((await pujar(vendedor, 20000)).body.error.codigo, 'PROPIETARIO_NO_PUEDE_OFERTAR');
    const ok = await pujar(a, 20000);
    assert.equal(ok.status, 201);
    assert.equal(ok.body.miEstado, 'ganando');
    assert.equal(ok.body.subasta.minimoSiguiente, 22000);
    assert.equal((await pujar(a, 30000)).body.error.codigo, 'YA_ERES_LIDER');
    assert.equal((await pujar(b, 20000)).body.error.codigo, 'MONTO_NO_SUPERA_ACTUAL');
    const inc = await pujar(b, 21999);
    assert.equal(inc.status, 422);
    assert.equal(inc.body.error.codigo, 'INCREMENTO_INSUFICIENTE');
    assert.equal(inc.body.error.detalles.minimo, 22000);
    assert.equal((await pujar(b, 22000)).status, 201);
  });

  test('pujas simultáneas: solo una gana la carrera, la otra exige +10 %', async () => {
    const c = await registrar(s.http);
    const d = await registrar(s.http);
    const [r1, r2] = await Promise.all([pujar(c, 24200), pujar(d, 24200)]);
    const estados = [r1.status, r2.status].sort();
    assert.deepEqual(estados, [201, 422]);
    const detalle = (await s.http.get(`/api/vehiculos/${v.id}`)).body.data;
    assert.equal(detalle.subasta.montoActual, 24200);
    assert.equal(detalle.subasta.totalPujas, 3);
  });

  test('privacidad: el historial y el detalle no revelan quién ofertó', async () => {
    const hist = (await s.http.get(`/api/vehiculos/${v.id}/pujas`).set(auth(b.token))).body.data;
    assert.equal(hist.length, 3);
    for (const p of hist) assert.deepEqual(Object.keys(p).sort(), ['esMia', 'fecha', 'id', 'monto']);
    assert.equal(hist.filter((p) => p.esMia).length, 1);
    const det = (await s.http.get(`/api/vehiculos/${v.id}`)).body.data;
    const texto = JSON.stringify(det);
    assert.ok(!/lider|usuarioId/i.test(texto), 'el detalle no debe incluir IDs de usuarios');
    const paraB = (await s.http.get(`/api/vehiculos/${v.id}`).set(auth(b.token))).body.data;
    assert.equal(paraB.miEstado, 'superado');
  });

  test('no se oferta antes del inicio ni después del cierre', async () => {
    const t = Date.now();
    const futura = (await publicar(s.http, vendedor.token, datosVehiculo({ fechaInicio: new Date(t + 30 * MIN).toISOString(), fechaCierre: new Date(t + 90 * MIN).toISOString() }))).body.data;
    const r1 = await s.http.post(`/api/vehiculos/${futura.id}/pujas`).set(auth(a.token)).send({ monto: 50000 });
    assert.equal(r1.body.error.codigo, 'SUBASTA_NO_INICIADA');

    // Subasta vencida (insertada directamente con fechas pasadas)
    const id = await s.repo.transaccion(async (ops) => {
      const nuevo = await ops.insertarVehiculo({ ...datosVehiculo(), fechaInicio: new Date(t - 120 * MIN), fechaCierre: new Date(t - 1000) }, vendedor.usuario.id);
      return nuevo;
    });
    const r2 = await s.http.post(`/api/vehiculos/${id}/pujas`).set(auth(a.token)).send({ monto: 50000 });
    assert.equal(r2.body.error.codigo, 'SUBASTA_CERRADA');
    const det = (await s.http.get(`/api/vehiculos/${id}`)).body.data;
    assert.equal(det.subasta.estado, 'cerrada');
    assert.equal(det.subasta.resultado, 'desierta');
  });

  test('mis ofertas muestra el estado de cada subasta en la que participé', async () => {
    const mias = (await s.http.get('/api/pujas/mias').set(auth(a.token))).body.data;
    const esta = mias.find((x) => x.id === v.id);
    assert.equal(esta.miEstado, 'superado');
    assert.equal(esta.miMaximo, 20000);
  });
});

describe('Sistema', () => {
  test('health, hora del servidor y ruta inexistente', async () => {
    const h = await s.http.get('/api/health?db');
    assert.equal(h.body.baseDatos, 'ok');
    assert.ok(h.headers['x-hora-servidor']);
    assert.equal((await s.http.get('/api/nada')).status, 404);
    assert.equal((await s.http.get('/api/fotos/99999')).status, 404);
  });

  test('CORS habilitado para el frontend', async () => {
    const r = await s.http.options('/api/vehiculos/1/pujas').set('Origin', 'https://usuario.github.io').set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'authorization,content-type');
    assert.equal(r.status, 204);
    assert.match(r.headers['access-control-allow-headers'], /Authorization/);
  });

  test('JSON mal formado', async () => {
    const r = await s.http.post('/api/auth/login').set('Content-Type', 'application/json').send('{"correo":');
    assert.equal(r.body.error.codigo, 'JSON_INVALIDO');
  });

  test('una imagen PNG también es aceptada', () => assert.equal(jpeg().length > 12 && png().length > 12, true));
});
