import React from 'react';

const OptionButton = ({ label, selected, onClick }) => (
  <button
    type="button"
    className={`verify-option ${selected ? 'is-selected' : ''}`}
    onClick={onClick}
  >
    {label}
  </button>
);

export default OptionButton;
