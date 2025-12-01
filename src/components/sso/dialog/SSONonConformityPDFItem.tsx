import { SSOChecklistItem } from '@/types/sso';

interface SSONonConformityPDFItemProps {
  item: SSOChecklistItem;
  index: number;
}

export const SSONonConformityPDFItem = ({ item, index }: SSONonConformityPDFItemProps) => {
  return (
    <div 
      className="nc-card"
      style={{
        pageBreakInside: 'avoid',
        breakInside: 'avoid',
        marginBottom: '24px',
        padding: '20px',
        borderRadius: '12px',
        backgroundColor: '#ffffff',
        border: '2px solid #fecaca',
        boxShadow: '0 2px 4px rgba(0,0,0,0.08)'
      }}
    >
      {/* Header da Não Conformidade - Flexbox Alinhado */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #e5e7eb'
        }}
      >
        {/* Lado Esquerdo: Número + Categoria */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          {/* Círculo com Número */}
          <div 
            style={{
              flexShrink: 0,
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: '#fef2f2',
              border: '2px solid #ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
              {index + 1}
            </span>
          </div>

          {/* Chip de Categoria - Pílula */}
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              border: '1px solid #93c5fd',
              lineHeight: 1.2
            }}
          >
            {item.tema}
          </span>
        </div>

        {/* Lado Direito: Badge Não Conforme */}
        <span 
          style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: 700,
            backgroundColor: '#dc2626',
            color: '#ffffff',
            lineHeight: 1.2
          }}
        >
          Não Conforme
        </span>
      </div>

      {/* Descrição do Item */}
      <div style={{ marginBottom: '16px' }}>
        <h4 
          style={{
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.5,
            color: '#1f2937',
            margin: 0,
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap'
          }}
        >
          {item.descricao}
        </h4>
      </div>

      {/* Evidência Objetiva */}
      {item.evidencia && (
        <div 
          className="nc-evidence"
          style={{
            marginBottom: '16px',
            padding: '14px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb'
          }}
        >
          <p 
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: '8px',
              margin: '0 0 8px 0'
            }}
          >
            📋 Evidência Objetiva:
          </p>
          <p 
            style={{
              fontSize: '13px',
              lineHeight: 1.6,
              color: '#374151',
              margin: 0,
              wordWrap: 'break-word',
              whiteSpace: 'pre-wrap'
            }}
          >
            {item.evidencia}
          </p>
        </div>
      )}

      {/* Registro Fotográfico */}
      {item.fotos && item.fotos.length > 0 && (
        <div 
          className="nc-photo-box"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid'
          }}
        >
          <p 
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: '#6b7280',
              marginBottom: '10px',
              margin: '0 0 10px 0'
            }}
          >
            📷 Registro Fotográfico ({item.fotos.length} {item.fotos.length === 1 ? 'foto' : 'fotos'}):
          </p>
          <div 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '10px'
            }}
          >
            {item.fotos.slice(0, 4).map((foto, photoIndex) => (
              <div
                key={photoIndex}
                style={{
                  position: 'relative',
                  aspectRatio: '16/9',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb',
                  backgroundColor: '#f3f4f6',
                  minHeight: '120px',
                  maxHeight: '160px'
                }}
              >
                <img
                  src={foto.url || foto.path}
                  alt={`Foto ${photoIndex + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  crossOrigin="anonymous"
                />
                <div 
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    right: '6px',
                    backgroundColor: 'rgba(0,0,0,0.75)',
                    color: '#ffffff',
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontWeight: 600
                  }}
                >
                  {photoIndex + 1}
                </div>
              </div>
            ))}
          </div>
          {item.fotos.length > 4 && (
            <p 
              style={{
                textAlign: 'center',
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '10px',
                padding: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                margin: '10px 0 0 0'
              }}
            >
              + {item.fotos.length - 4} {item.fotos.length - 4 === 1 ? 'foto adicional' : 'fotos adicionais'}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
