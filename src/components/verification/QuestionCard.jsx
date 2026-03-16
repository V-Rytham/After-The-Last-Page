import React from 'react';
import OptionButton from './OptionButton';

const QuestionCard = ({ question, selectedIndex, onSelect }) => (
  <section className="verify-card glass-panel">
    <h2 className="font-serif verify-question">{question.question}</h2>
    <div className="verify-options">
      {question.options.map((option, index) => (
        <OptionButton
          key={`${option}-${index}`}
          label={option}
          selected={selectedIndex === index}
          onClick={() => onSelect(index)}
        />
      ))}
    </div>
  </section>
);

export default QuestionCard;
