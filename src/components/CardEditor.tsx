import { useState, useRef } from 'react';
import { useStore } from '../stores/useStore';
import type { CardType, CardOption } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface CardEditorProps {
  deckId: string;
  onBack: () => void;
  onGoToImport?: () => void;
}

const CARD_TYPE_LABELS: Record<CardType, string> = {
  flashcard: 'フラッシュカード',
  true_false: '正誤問題',
  multiple_choice: '多肢選択',
};

export function CardEditor({ deckId, onBack, onGoToImport }: CardEditorProps) {
  const { decks, getCardsForDeck, addCard, updateCard, deleteCard, importCards } = useStore();

  const deck = decks.find((d) => d.id === deckId);
  const cards = getCardsForDeck(deckId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingCard, setEditingCard] = useState<{ id: string; front: string; back: string } | null>(null);

  // New card state
  const [cardType, setCardType] = useState<CardType>('flashcard');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [correctAnswer, setCorrectAnswer] = useState(true);
  const [options, setOptions] = useState<CardOption[]>([
    { id: uuidv4(), text: '', isCorrect: true },
    { id: uuidv4(), text: '', isCorrect: false },
    { id: uuidv4(), text: '', isCorrect: false },
    { id: uuidv4(), text: '', isCorrect: false },
  ]);

  const [importText, setImportText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setCardType('flashcard');
    setFront('');
    setBack('');
    setCorrectAnswer(true);
    setOptions([
      { id: uuidv4(), text: '', isCorrect: true },
      { id: uuidv4(), text: '', isCorrect: false },
      { id: uuidv4(), text: '', isCorrect: false },
      { id: uuidv4(), text: '', isCorrect: false },
    ]);
  };

  const handleAddCard = () => {
    if (!front.trim()) return;

    if (cardType === 'flashcard') {
      if (!back.trim()) return;
      addCard(deckId, front, back, 'flashcard');
    } else if (cardType === 'true_false') {
      addCard(deckId, front, correctAnswer ? '正しい' : '間違い', 'true_false', { correctAnswer });
    } else if (cardType === 'multiple_choice') {
      const validOptions = options.filter(o => o.text.trim());
      if (validOptions.length < 2) return;
      const correctOption = validOptions.find(o => o.isCorrect);
      addCard(deckId, front, correctOption?.text || '', 'multiple_choice', { options: validOptions });
    }

    resetForm();
    setShowAddModal(false);
  };

  const handleUpdateCard = () => {
    if (!editingCard) return;
    updateCard(editingCard.id, { front: editingCard.front, back: editingCard.back });
    setEditingCard(null);
  };

  const handleDeleteCard = (cardId: string) => {
    if (confirm('このカードを削除しますか？')) {
      deleteCard(cardId);
    }
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText);
      if (Array.isArray(parsed)) {
        const validCards = parsed.filter(
          (item) => typeof item.front === 'string' && (typeof item.back === 'string' || item.type)
        );
        if (validCards.length > 0) {
          importCards(deckId, validCards);
          setImportText('');
          setShowImportModal(false);
          return;
        }
      }
    } catch {
      const lines = importText.trim().split('\n');
      const validCards: { front: string; back: string }[] = [];
      for (const line of lines) {
        const parts = line.includes('\t') ? line.split('\t') : line.split(',');
        if (parts.length >= 2) {
          validCards.push({
            front: parts[0].trim().replace(/^["']|["']$/g, ''),
            back: parts[1].trim().replace(/^["']|["']$/g, ''),
          });
        }
      }
      if (validCards.length > 0) {
        importCards(deckId, validCards);
        setImportText('');
        setShowImportModal(false);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setImportText(event.target?.result as string);
    reader.readAsText(file);
  };

  const updateOption = (id: string, text: string) => {
    setOptions(options.map(o => o.id === id ? { ...o, text } : o));
  };

  const setCorrectOption = (id: string) => {
    setOptions(options.map(o => ({ ...o, isCorrect: o.id === id })));
  };

  const getCardTypeIcon = (type: CardType) => {
    switch (type) {
      case 'flashcard': return '📇';
      case 'true_false': return '⭕';
      case 'multiple_choice': return '🔢';
    }
  };

  return (
    <>
      <header className="header">
        <button className="header__back" onClick={onBack}>← 戻る</button>
        <h1 className="header__title">{deck?.name}</h1>
        <div style={{ width: 60 }}></div>
      </header>

      <div className="card-list">
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
          <button className="btn btn--primary" onClick={() => setShowAddModal(true)}>➕ カード追加</button>
          <button className="btn btn--secondary" onClick={() => onGoToImport ? onGoToImport() : setShowImportModal(true)}>📥 インポート</button>
        </div>

        {cards.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📝</div>
            <h3 className="empty-state__title">カードがありません</h3>
            <p className="empty-state__text">新しいカードを追加してください</p>
          </div>
        ) : (
          cards.map((card) => (
            <div key={card.id} className="card-list__item">
              <div className="card-list__content">
                <div className="card-list__front">
                  <span style={{ marginRight: '8px' }}>{getCardTypeIcon(card.type)}</span>
                  {card.front}
                </div>
                <div className="card-list__back">{card.back}</div>
              </div>
              <div className="card-list__actions">
                <button className="card-list__action" onClick={() => setEditingCard({ id: card.id, front: card.front, back: card.back })}>✏️</button>
                <button className="card-list__action card-list__action--delete" onClick={() => handleDeleteCard(card.id)}>🗑️</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Card Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => { setShowAddModal(false); resetForm(); }}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">新しいカード</h3>
              <button className="modal__close" onClick={() => { setShowAddModal(false); resetForm(); }}>×</button>
            </div>
            <div className="modal__body">
              {/* Card Type Selector */}
              <div className="form-group">
                <label className="form-group__label">カードタイプ</label>
                <div className="card-type-selector">
                  {(['flashcard', 'true_false', 'multiple_choice'] as CardType[]).map((type) => (
                    <button
                      key={type}
                      className={`card-type-btn ${cardType === type ? 'card-type-btn--active' : ''}`}
                      onClick={() => setCardType(type)}
                    >
                      <span className="card-type-btn__icon">{getCardTypeIcon(type)}</span>
                      <span>{CARD_TYPE_LABELS[type]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question */}
              <div className="form-group">
                <label className="form-group__label">問題</label>
                <textarea className="form-group__textarea" value={front} onChange={(e) => setFront(e.target.value)} autoFocus placeholder="問題を入力..." />
              </div>

              {/* Answer based on type */}
              {cardType === 'flashcard' && (
                <div className="form-group">
                  <label className="form-group__label">答え</label>
                  <textarea className="form-group__textarea" value={back} onChange={(e) => setBack(e.target.value)} placeholder="答えを入力..." />
                </div>
              )}

              {cardType === 'true_false' && (
                <div className="form-group">
                  <label className="form-group__label">正解</label>
                  <div className="true-false-selector">
                    <button
                      className={`tf-btn ${correctAnswer ? 'tf-btn--active tf-btn--true' : ''}`}
                      onClick={() => setCorrectAnswer(true)}
                    >
                      ⭕ 正しい
                    </button>
                    <button
                      className={`tf-btn ${!correctAnswer ? 'tf-btn--active tf-btn--false' : ''}`}
                      onClick={() => setCorrectAnswer(false)}
                    >
                      ❌ 間違い
                    </button>
                  </div>
                </div>
              )}

              {cardType === 'multiple_choice' && (
                <div className="form-group">
                  <label className="form-group__label">選択肢（正解をクリックして選択）</label>
                  <div className="options-list">
                    {options.map((option, index) => (
                      <div key={option.id} className="option-item">
                        <button
                          className={`option-radio ${option.isCorrect ? 'option-radio--selected' : ''}`}
                          onClick={() => setCorrectOption(option.id)}
                          title="正解にする"
                        >
                          {option.isCorrect ? '✓' : String.fromCharCode(65 + index)}
                        </button>
                        <input
                          className="form-group__input"
                          type="text"
                          placeholder={`選択肢 ${String.fromCharCode(65 + index)}`}
                          value={option.text}
                          onChange={(e) => updateOption(option.id, e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => { setShowAddModal(false); resetForm(); }}>キャンセル</button>
              <button className="btn btn--primary" onClick={handleAddCard}>追加</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Card Modal */}
      {editingCard && (
        <div className="modal-overlay" onClick={() => setEditingCard(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">カードを編集</h3>
              <button className="modal__close" onClick={() => setEditingCard(null)}>×</button>
            </div>
            <div className="modal__body">
              <div className="form-group">
                <label className="form-group__label">問題</label>
                <textarea className="form-group__textarea" value={editingCard.front} onChange={(e) => setEditingCard({ ...editingCard, front: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-group__label">答え</label>
                <textarea className="form-group__textarea" value={editingCard.back} onChange={(e) => setEditingCard({ ...editingCard, back: e.target.value })} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setEditingCard(null)}>キャンセル</button>
              <button className="btn btn--primary" onClick={handleUpdateCard}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <h3 className="modal__title">インポート</h3>
              <button className="modal__close" onClick={() => setShowImportModal(false)}>×</button>
            </div>
            <div className="modal__body">
              <div className="import-dropzone" onClick={() => fileInputRef.current?.click()}>
                <div className="import-dropzone__icon">📁</div>
                <p>ファイルを選択 (CSV/JSON)</p>
              </div>
              <input ref={fileInputRef} type="file" accept=".csv,.json,.txt" style={{ display: 'none' }} onChange={handleFileUpload} />
              <div className="form-group" style={{ marginTop: 'var(--spacing-lg)' }}>
                <label className="form-group__label">または直接貼り付け</label>
                <textarea className="form-group__textarea" style={{ minHeight: '120px' }} placeholder="問題,答え" value={importText} onChange={(e) => setImportText(e.target.value)} />
              </div>
            </div>
            <div className="modal__footer">
              <button className="btn btn--secondary" onClick={() => setShowImportModal(false)}>キャンセル</button>
              <button className="btn btn--primary" onClick={handleImport}>インポート</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
