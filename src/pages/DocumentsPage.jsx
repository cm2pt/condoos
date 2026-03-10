import { formatDate, cleanLabel } from "../lib/formatters.js";
import StatusPill from "../components/shared/StatusPill.jsx";
import Icon from "../components/shared/Icon.jsx";

export default function DocumentsPage({
  documents,
  docQuery,
  setDocQuery,
  showStoragePath = false,
  showVisibility = true,
  onDownloadDocument,
  onUploadDocument,
  onUploadDocumentVersion,
  isUploadingDocument = false,
}) {
  const visibilitySummary = documents.reduce(
    (acc, document) => {
      acc[document.visibility] = (acc[document.visibility] || 0) + 1;
      return acc;
    },
    { manager_only: 0, residents: 0, all: 0 }
  );

  return (
    <div className="stack-lg">
      <article className="panel">
        <header className="panel-header split-header">
          <div className="panel-header-left">
            <Icon name="FolderOpen" size={16} className="panel-header-icon" />
            <h3>Biblioteca documental</h3>
          </div>
          <div className="inline-actions stretch-right">
            <div className="search-wrap">
              <Icon name="Search" size={15} className="search-input-icon" />
              <input
                type="search"
                value={docQuery}
                onChange={(event) => setDocQuery(event.target.value)}
                placeholder={showVisibility ? "Pesquisar por título ou categoria" : "Pesquisar documentos"}
              />
            </div>
            {onUploadDocument ? (
              <button type="button" className="mini-btn" onClick={onUploadDocument} disabled={isUploadingDocument}>
                {isUploadingDocument ? "A carregar..." : <><Icon name="Upload" size={14} /> Carregar documento</>}
              </button>
            ) : null}
          </div>
        </header>

        {showVisibility ? (
          <div className="pill-group">
            <span className="stat-pill">
              Gestão <strong>{visibilitySummary.manager_only}</strong>
            </span>
            <span className="stat-pill">
              Condóminos <strong>{visibilitySummary.residents}</strong>
            </span>
            <span className="stat-pill">
              Todos <strong>{visibilitySummary.all}</strong>
            </span>
          </div>
        ) : (
          <div className="empty-state-box">
            <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
            <p className="empty-state-title">Portal</p>
            <p className="empty-state-subtitle">Mostramos apenas documentos úteis para a sua experiência no portal.</p>
          </div>
        )}
      </article>

      <article className="panel">
        <header className="panel-header">
          <div className="panel-header-left">
            <Icon name="FolderOpen" size={16} className="panel-header-icon" />
            <h3>Documentos carregados</h3>
          </div>
          <span>{documents.length} ficheiros visíveis</span>
        </header>
        <div className="table-wrap">
          <table className="docs-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Categoria</th>
                <th>Data de upload</th>
                {showVisibility ? <th>Visibilidade</th> : null}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr className="table-row-static">
                  <td colSpan={showVisibility ? 5 : 4}>
                    <div className="empty-state-box">
                      <div className="empty-state-icon-circle"><Icon name="Inbox" size={28} /></div>
                      <p className="empty-state-title">Sem documentos</p>
                      <p className="empty-state-subtitle">Não existem documentos para este filtro.</p>
                    </div>
                  </td>
                </tr>
              ) : null}
              {documents.map((document) => (
                <tr key={document.id} className="table-row-static">
                  <td>
                    <div className="doc-list-copy">
                      <span>{document.title}</span>
                      {showStoragePath && document.storagePath ? <small>{document.storagePath}</small> : null}
                    </div>
                  </td>
                  <td>{cleanLabel(document.category)}</td>
                  <td>{formatDate(document.uploadedAt)}</td>
                  {showVisibility ? (
                    <td>
                      <StatusPill label={cleanLabel(document.visibility)} tone="neutral" />
                    </td>
                  ) : null}
                  <td>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="mini-btn"
                        onClick={() => onDownloadDocument?.(document)}
                        disabled={!onDownloadDocument}
                        aria-label={`Descarregar documento ${document.title}`}
                      >
                        <Icon name="Download" size={14} /> Descarregar
                      </button>
                      {onUploadDocumentVersion ? (
                        <button
                          type="button"
                          className="ghost-btn compact"
                          onClick={() => onUploadDocumentVersion(document)}
                          disabled={isUploadingDocument}
                          aria-label={`Carregar nova versão para ${document.title}`}
                        >
                          <Icon name="Upload" size={14} /> Nova versão
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
