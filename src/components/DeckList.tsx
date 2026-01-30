import { useState } from 'react';
import { useStore } from '../stores/useStore';
import type { Deck } from '../types';

const DECK_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

interface DeckListProps {
  onSelectDeck: (deck: Deck) => void;
  onImport?: (deck: Deck) => void;
}

export function DeckList({ onSelectDeck, onImport }: DeckListProps) {
  const { decks, cards, addDeck, deleteDeck, getDueCardsForDeck } = useStore();
  const [showModal, setShowModal] = useState(false);
  const [newDeck, setNewDeck] = useState({ name: '', description: '', color: DECK_COLORS[0] });

  const handleAddDeck = () => {
    if (!newDeck.name.trim()) return;
    addDeck(newDeck.name, newDeck.description, newDeck.color);
    setNewDeck({ name: '', description: '', color: DECK_COLORS[0] });
    setShowModal(false);
  };

  const handleDeleteDeck = (e: React.MouseEvent, deckId: string) => {
    e.stopPropagation();
    if (confirm('このデッキを削除しますか？')) deleteDeck(deckId);
  };

  return (
    <>
      <div className="deck-list">
        <h2 className="deck-list__title">デッキ一覧</h2>
        {decks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">デッキがありません</h3>
            <p className="empty-state__text">新しいデッキを作成して学習を始めましょう</p>
          </div>
        ) : (
          decks.map((deck) => {
            const deckCards = cards.filter((c) => c.deckId === deck.id);
            const dueCards = getDueCardsForDeck(deck.id);
            const masteredCount = deckCards.filter((c) => c.repetition >= 3).length;
            const progress = deckCards.length > 0 ? (masteredCount / deckCards.length) * 100 : 0;
            return (
              <div key={deck.id} className="deck-card" style={{ '--deck-color': deck.color } as React.CSSProperties} onClick={() => onSelectDeck(deck)}>
                <div className="deck-card__header">
                  <h3 className="deck-card__name">{deck.name}</h3>
                  <span className={`deck-card__due ${dueCards.length === 0 ? 'deck-card__due--none' : ''}`}>
                    {dueCards.length > 0 ? `${dueCards.length} 枚復習` : '完了'}
                  </span>
                </div>
                {deck.description && <p className="deck-card__description">{deck.description}</p>}
                <div className="deck-card__progress"><div className="deck-card__progress-bar" style={{ width: `${progress}%` }} /></div>
                <div className="deck-card__stats">
                  <span>📇 {deckCards.length} 枚</span>
                  <span>✅ {masteredCount} 習得</span>
                  {onImport && (
                    <button className="card-list__action card-list__action--import" onClick={(e) => { e.stopPropagation(); onImport(deck); }} title="インポート">📥</button>
                  )}
                  <button className="card-list__action card-list__action--delete" onClick={(e) => handleDeleteDeck(e, deck.id)} title="削除">🗑️</button>
                </div>
              </div>
            );
          })
        )}
        <button className="add-deck-btn" onClick={() => setShowModal(true)}>
          <span>➕</span><span>新しいデッキを追加</span>
        </button>
      </div>
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">新しいデッキ</h3>
              <button className="modal__close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-group__label">デッキ名</label>
                <input className="form-group__input" type="text" placeholder="例: TOEIC英単語" value={newDeck.name} onChange={(e) => setNewDeck({ ...newDeck, name: e.target.value })} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-group__label">説明（任意）</label>
                <textarea className="form-group__textarea" placeholder="このデッキの説明..." value={newDeck.description} onChange={(e) => setNewDeck({ ...newDeck, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-group__label">カラー</label>
                <div className="color-picker">
                  {DECK_COLORS.map((color) => (
                    <button key={color} className={`color-picker__option ${newDeck.color === color ? 'color-picker__option--selected' : ''}`} style={{ backgroundColor: color }} onClick={() => setNewDeck({ ...newDeck, color })} />
                  ))}
                </div>
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowModal(false)}>キャンセル</button>
              <button className="btn btn--primary" onClick={handleAddDeck} disabled={!newDeck.name.trim()}>作成</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
