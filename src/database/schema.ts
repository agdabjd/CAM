export const SCHEMA_V1 = `
  CREATE TABLE perfis (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    nome TEXT NOT NULL,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    data_nascimento TEXT,
    senha_hash TEXT NOT NULL,
    senha_salt TEXT NOT NULL,
    senha_parametros TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE configuracoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfil_id INTEGER NOT NULL DEFAULT 1,
    modo TEXT NOT NULL
      CHECK (modo IN ('anticoncepcional', 'menstrual')),

    vigente_desde TEXT NOT NULL,
    vigente_ate TEXT,
    data_referencia TEXT NOT NULL,

    metodo TEXT,
    acao TEXT,
    intervalo_dias INTEGER,
    horario TEXT,

    pausa_tipo TEXT NOT NULL DEFAULT 'nenhuma'
      CHECK (pausa_tipo IN ('nenhuma', 'dias', 'acoes')),
    pausa_apos INTEGER,
    pausa_duracao_dias INTEGER,

    duracao_ciclo_dias INTEGER,
    duracao_menstruacao_dias INTEGER,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (perfil_id) REFERENCES perfis(id)
      ON DELETE CASCADE,

    UNIQUE (perfil_id, vigente_desde),

    CHECK (
      vigente_ate IS NULL OR vigente_ate > vigente_desde
    ),

    CHECK (
      intervalo_dias IS NULL OR intervalo_dias > 0
    ),

    CHECK (
      (
        pausa_tipo = 'nenhuma'
        AND pausa_apos IS NULL
        AND pausa_duracao_dias IS NULL
      )
      OR
      (
        pausa_tipo IN ('dias', 'acoes')
        AND pausa_apos IS NOT NULL
        AND pausa_apos > 0
        AND pausa_duracao_dias IS NOT NULL
        AND pausa_duracao_dias > 0
      )
    ),

    CHECK (
      (
        modo = 'anticoncepcional'
        AND metodo IS NOT NULL
        AND acao IS NOT NULL
        AND intervalo_dias IS NOT NULL
        AND horario IS NOT NULL
        AND duracao_ciclo_dias IS NULL
        AND duracao_menstruacao_dias IS NULL
      )
      OR
      (
        modo = 'menstrual'
        AND metodo IS NULL
        AND acao IS NULL
        AND intervalo_dias IS NULL
        AND horario IS NULL
        AND pausa_tipo = 'nenhuma'
        AND duracao_ciclo_dias IS NOT NULL
        AND duracao_ciclo_dias > 0
        AND duracao_menstruacao_dias IS NOT NULL
        AND duracao_menstruacao_dias > 0
        AND duracao_menstruacao_dias <= duracao_ciclo_dias
      )
    )
  );

  CREATE UNIQUE INDEX configuracao_aberta_por_perfil
    ON configuracoes(perfil_id)
    WHERE vigente_ate IS NULL;

  CREATE TABLE registros_diarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfil_id INTEGER NOT NULL DEFAULT 1,
    data TEXT NOT NULL,
    humor TEXT,
    sangramento_fluxo TEXT NOT NULL DEFAULT 'nenhum'
      CHECK (
        sangramento_fluxo IN (
          'nenhum', 'manchas', 'leve', 'moderado', 'intenso'
        )
      ),
    sangramento_tipo TEXT NOT NULL DEFAULT 'nao_informado'
      CHECK (
        sangramento_tipo IN (
          'menstruacao', 'outro', 'nao_informado'
        )
      ),
    observacoes TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (perfil_id) REFERENCES perfis(id)
      ON DELETE CASCADE,

    UNIQUE (perfil_id, data)
  );

  CREATE TABLE sintomas_registrados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_diario_id INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    intensidade TEXT,

    FOREIGN KEY (registro_diario_id)
      REFERENCES registros_diarios(id)
      ON DELETE CASCADE,

    UNIQUE (registro_diario_id, descricao)
  );

  CREATE TABLE acoes_realizadas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registro_diario_id INTEGER NOT NULL,
    configuracao_id INTEGER NOT NULL,
    horario_real TEXT NOT NULL,
    data_prevista TEXT,
    observacoes TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (registro_diario_id)
      REFERENCES registros_diarios(id)
      ON DELETE CASCADE,

    FOREIGN KEY (configuracao_id)
      REFERENCES configuracoes(id)
      ON DELETE RESTRICT,

    UNIQUE (configuracao_id, data_prevista)
  );

  CREATE TABLE lembretes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfil_id INTEGER NOT NULL DEFAULT 1,
    tipo TEXT NOT NULL CHECK (
      tipo IN (
        'acao', 'inicio_pausa', 'fim_pausa',
        'registro', 'resumo_semanal', 'personalizado'
      )
    ),
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1
      CHECK (ativo IN (0, 1)),

    repeticao TEXT NOT NULL CHECK (
      repeticao IN ('regime', 'unico', 'diario', 'semanal')
    ),
    data TEXT,
    horario TEXT,
    dia_semana INTEGER CHECK (dia_semana BETWEEN 0 AND 6),
    antecedencia_dias INTEGER NOT NULL DEFAULT 0
      CHECK (antecedencia_dias >= 0),

    ids_notificacoes_json TEXT NOT NULL DEFAULT '[]',

    FOREIGN KEY (perfil_id) REFERENCES perfis(id)
      ON DELETE CASCADE
  );

  CREATE INDEX acoes_por_registro
    ON acoes_realizadas(registro_diario_id);

  CREATE INDEX sintomas_por_registro
    ON sintomas_registrados(registro_diario_id);
`;

export const SCHEMA_V2 = `
  CREATE TABLE menstruacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    perfil_id INTEGER NOT NULL DEFAULT 1,
    configuracao_id INTEGER NOT NULL,
    data_inicio TEXT NOT NULL,
    data_fim TEXT,
    observacoes TEXT NOT NULL DEFAULT '',
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (perfil_id)
      REFERENCES perfis(id)
      ON DELETE CASCADE,

    FOREIGN KEY (configuracao_id)
      REFERENCES configuracoes(id)
      ON DELETE RESTRICT,

    CHECK (
      data_fim IS NULL OR data_fim >= data_inicio
    ),

    UNIQUE (perfil_id, data_inicio)
  );

  CREATE UNIQUE INDEX menstruacao_aberta_por_perfil
    ON menstruacoes(perfil_id)
    WHERE data_fim IS NULL;

  CREATE INDEX menstruacoes_por_inicio
    ON menstruacoes(perfil_id, data_inicio);
`;

export const SCHEMA_V3 = `
  ALTER TABLE perfis ADD COLUMN sessao_hash TEXT;
`;