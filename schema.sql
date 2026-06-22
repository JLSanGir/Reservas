-- ============================================================
-- RESERVAS — Schema SQL para Supabase
-- Ejecutar en el SQL Editor de Supabase Dashboard
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLA: reservas
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservas (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fecha_inicio   DATE NOT NULL,
  fecha_fin      DATE NOT NULL,
  huespedes      SMALLINT NOT NULL CHECK (huespedes BETWEEN 1 AND 20),
  precio_total   NUMERIC(10, 2) NOT NULL CHECK (precio_total >= 0),
  nombre_cliente TEXT NOT NULL DEFAULT '',
  telefono       TEXT DEFAULT '',
  notas          TEXT DEFAULT '',
  origen         TEXT NOT NULL DEFAULT 'PROPIO' CHECK (origen IN ('BOOKING', 'AIRBNB', 'PROPIO', 'OTROS')),
  llaves_entregadas BOOLEAN NOT NULL DEFAULT FALSE,
  limpieza_hecha    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),

  -- La fecha de fin debe ser posterior a la de inicio
  CONSTRAINT chk_fechas_validas CHECK (fecha_fin > fecha_inicio)
);

-- Índice para búsquedas por rango de fechas (consulta principal del calendario)
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'PROPIO'
  CHECK (origen IN ('BOOKING', 'AIRBNB', 'PROPIO', 'OTROS'));

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS llaves_entregadas BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS limpieza_hecha BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_reservas_fechas
  ON reservas USING GIST (daterange(fecha_inicio, fecha_fin));

-- Índice auxiliar para ordenar por fecha de inicio
CREATE INDEX idx_reservas_inicio ON reservas (fecha_inicio);

-- ────────────────────────────────────────────────────────────
-- 2. FUNCIÓN: Evitar solapamiento de reservas
--    Usa un EXCLUSION CONSTRAINT con rangos de fecha.
--    Dos reservas NO pueden tener rangos que se crucen.
-- ────────────────────────────────────────────────────────────

-- Necesitamos la extensión btree_gist para exclusion con tipos mixtos
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Constraint de exclusión: impide reservas solapadas
ALTER TABLE reservas
  ADD CONSTRAINT excl_reservas_sin_solapamiento
  EXCLUDE USING GIST (
    daterange(fecha_inicio, fecha_fin) WITH &&
  );

-- ────────────────────────────────────────────────────────────
-- 3. TABLA: precios_disponibles
--    Precios custom por día (sobreescribe el precio de temporada).
--    Solo para días NO alquilados; el frontend prioriza esta tabla.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS precios_disponibles (
  fecha   DATE PRIMARY KEY,
  precio  NUMERIC(8, 2) NOT NULL CHECK (precio >= 0),
  minimo_noches INTEGER NOT NULL DEFAULT 1 CHECK (minimo_noches >= 1)
);

ALTER TABLE precios_disponibles
  ADD COLUMN IF NOT EXISTS minimo_noches INTEGER NOT NULL DEFAULT 1 CHECK (minimo_noches >= 1);

-- ────────────────────────────────────────────────────────────
-- 4. TRIGGER: Actualizar updated_at automáticamente
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reservas_updated
  BEFORE UPDATE ON reservas
  FOR EACH ROW
  EXECUTE FUNCTION actualizar_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. RLS (Row Level Security) — Políticas básicas
--    Permite acceso completo con la anon key (app privada).
--    Ajustar si se añade autenticación de usuarios.
-- ────────────────────────────────────────────────────────────
ALTER TABLE reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE precios_disponibles ENABLE ROW LEVEL SECURITY;

-- Política permisiva para la anon key (app de uso personal)
CREATE POLICY "Acceso completo reservas"
  ON reservas FOR ALL
  USING (true) WITH CHECK (true);

CREATE POLICY "Acceso completo precios"
  ON precios_disponibles FOR ALL
  USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'reservas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservas;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'precios_disponibles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE precios_disponibles;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. DATOS DE EJEMPLO (opcional — borrar en producción)
-- ────────────────────────────────────────────────────────────
INSERT INTO reservas (fecha_inicio, fecha_fin, huespedes, precio_total, nombre_cliente, telefono, notas)
VALUES
  ('2026-05-03', '2026-05-07', 4, 400.00, 'García López',    '+34 612 345 678', 'Check-in tardío (22:00)'),
  ('2026-05-15', '2026-05-20', 2, 500.00, 'Martín Ruiz',     '+34 698 765 432', ''),
  ('2026-05-28', '2026-06-02', 3, 600.00, 'Fernández Díaz',  '+34 654 321 987', 'Necesitan cuna'),
  ('2026-06-10', '2026-06-15', 5, 750.00, 'Rodríguez Sanz',  '',                ''),
  ('2026-06-22', '2026-06-28', 2, 680.00, 'López Herrera',   '+34 611 222 333', '');

INSERT INTO precios_disponibles (fecha, precio)
VALUES
  ('2026-05-01', 95.00),
  ('2026-05-02', 95.00);
