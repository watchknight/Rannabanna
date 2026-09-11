import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useDatabase } from '../context/DatabaseContext'
import { getCuisineImage } from '../utils/imageAssets'

function CuisineCard({ cuisine }) {
  const navigate = useNavigate()
  const { recipes, language, toBengaliNumber } = useDatabase()
  
  const recipeCount = recipes.filter(r => r.cuisineId === cuisine.id).length
  const cuisineName = language === 'bn' ? (cuisine.nameBn || cuisine.name) : cuisine.name
  const regionName = language === 'bn' ? (cuisine.regionBn || cuisine.region) : cuisine.region
  const imageUrl = getCuisineImage(cuisine.id)

  return (
    <div 
      className="cuisine-card glass-panel glass-panel-hover"
      onClick={() => navigate(`/cuisine/${cuisine.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/cuisine/${cuisine.id}`);
        }
      }}
      tabIndex={0}
      role="button"
      id={`cuisine-card-${cuisine.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#0D111A',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Upper Photo Frame - Unobstructed Photography (No Murky Gradients) */}
      <div style={{ position: 'relative', width: '100%', height: '150px', overflow: 'hidden', background: '#141A26' }}>
        <img
          src={imageUrl}
          alt={cuisineName}
          loading="lazy"
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
          className="cuisine-card-photo"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = getCuisineImage('bengali');
          }}
        />
        <div 
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            padding: '3px 9px',
            borderRadius: '6px',
            background: 'rgba(10, 14, 22, 0.75)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.7rem',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: cuisine.color || 'var(--brand-orange)'
          }}
        >
          {regionName}
        </div>
      </div>

      {/* Clean Lower Metadata Compartment */}
      <div 
        className="cuisine-card-content"
        style={{
          padding: '14px 16px',
          background: '#0D111A',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="cuisine-card-name" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: 0 }}>
            {cuisineName}
          </h3>
          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
            <ChevronRight size={14} />
          </div>
        </div>

        <span className="cuisine-card-count" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {language === 'bn' ? `${toBengaliNumber(recipeCount)}টি রেসিপি` : `${recipeCount} ${recipeCount === 1 ? 'Recipe' : 'Recipes'}`}
        </span>
      </div>
    </div>
  )
}

export default React.memo(CuisineCard)
