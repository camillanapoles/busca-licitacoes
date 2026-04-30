/**
 * Tipos compartilhados para a arquitetura de múltiplas fontes de licitações.
 * Cada fonte implementa a interface SourceCollector e normaliza seus dados
 * para NormalizedLicitacao antes de persistir no banco.
 */

// ─── Códigos de Fonte ────────────────────────────────────────────────────────

export type SourceCode =
  | "PNCP"
  | "COMPRAS_GOV"
  | "PORTAL_COMPRAS_PUBLICAS"
  | "TRANSPARENCIA"
  | "BEC_SP"
  | "TCE_SP"
  | "TCE_RJ"
  | "TCE_RS";

export type SourceConfig = Record<string, string>;

// ─── Licitação Normalizada ───────────────────────────────────────────────────

/**
 * Formato canônico de licitação. Todos os coletores devem produzir este tipo
 * antes de chamar upsertLicitacao().
 */
export type NormalizedLicitacao = {
  fonte: SourceCode;
  /** Identificador único da licitação na fonte de origem */
  fonteId: string;
  orgao?: string | null;
  cnpjOrgao?: string | null;
  uf?: string | null;
  municipio?: string | null;
  modalidade?: string | null;
  numeroCompra?: string | null;
  anoCompra?: number | null;
  sequencialCompra?: string | null;
  objeto: string;
  valorEstimado?: number | null;
  dataPublicacao?: Date | null;
  dataFimProposta?: Date | null;
  status?: string | null;
  link?: string | null;
  /** Payload bruto original da fonte — preservado para auditoria */
  rawPayload: unknown;
};

// ─── Resultado de Coleta ─────────────────────────────────────────────────────

export type CollectionResult = {
  fonte: SourceCode;
  totalColetado: number;
  totalNovo: number;
  totalAtualizado: number;
  errors: string[];
};

// ─── Parâmetros de Coleta ────────────────────────────────────────────────────

export type CollectionParams = {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  logId?: string;
  sourceConfig?: SourceConfig;
};

// ─── Interface de Coletor ────────────────────────────────────────────────────

/**
 * Interface que toda fonte deve implementar.
 * Registre novos coletores em src/lib/sources/registry.ts.
 */
export type SourceCollector = {
  /** Código único da fonte */
  code: SourceCode;
  /** Nome legível da fonte */
  name: string;
  /**
   * Indica se a fonte está configurada.
   * Se false, o collector retornará erro controlado sem quebrar o sistema.
   */
  isConfigured: (config?: SourceConfig) => boolean;
  /** Executa a coleta e retorna o resultado consolidado */
  collect: (params: CollectionParams) => Promise<CollectionResult>;
};

// ─── Metadados de Fonte (para exibição no painel) ───────────────────────────

export type SourceInfo = {
  code: SourceCode;
  name: string;
  description: string;
  isConfigured: boolean;
  envVarsRequired: string[];
  ativo: boolean;
  configKeys: string[];
};
