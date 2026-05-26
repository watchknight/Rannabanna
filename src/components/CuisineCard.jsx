import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useDatabase } from '../context/DatabaseContext'

function CuisineCard({ cuisine }) {
  const navigate = useNavigate()
  const { recipes, language } = useDatabase()
  
  // Count how many recipes we have in this cuisine
  const recipeCount = recipes.filter(r => r.cuisineId === cuisine.id).length
  const cuisineName = language === 'bn' ? (cuisine.nameBn || cuisine.name) : cuisine.name

  return (
    <div 
      className="cuisine-card glass-panel glass-panel-hover"
      onClick={() => navigate(`/cuisine/${cuisine.id}`)}
      id={`cuisine-card-${cuisine.id}`}
    >
      <div 
        className="cuisine-card-bg"
        style={{
          background: `linear-gradient(135deg, ${cuisine.color}dd 0%, #0a0a0f 100%)`
        }}
      />
      <div className="cuisine-card-content">
        <span className="cuisine-card-emoji">{cuisine.emoji}</span>
        <h3 className="cuisine-card-name">{cuisineName}</h3>
        <span className="cuisine-card-count">
          {language === 'bn' ? `${recipeCount}টি রেসিপি` : `${recipeCount} ${recipeCount === 1 ? 'Recipe' : 'Recipes'}`}
        </span>
      </div>
    </div>
  )
}

export default CuisineCard
