import React, { useMemo } from 'react';
import './VisualKeyboard.css';

const VisualKeyboard = ({ bindings = {}, onBindKey, activeKeys = new Set(), isBindingMode = false }) => {
    // Detect layout based on navigator language
    const isAzerty = useMemo(() => navigator.language.toLowerCase().startsWith('fr'), []);

    const ROWS = useMemo(() => {
        if (isAzerty) {
            return [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['A', 'Z', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
                ['Q', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'M'],
                ['W', 'X', 'C', 'V', 'B', 'N']
            ];
        }
        return [
            ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
            ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
            ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
            ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
        ];
    }, [isAzerty]);

    const NUMPAD = [
        ['7', '8', '9'],
        ['4', '5', '6'],
        ['1', '2', '3'],
        ['0']
    ];

    const renderKey = (keyChar, customClass = '') => {
        const keyLower = keyChar.toLowerCase();
        const binding = bindings[keyLower];
        const hasBinding = !!binding;
        const isActive = activeKeys.has(keyLower);

        let className = `vk-key ${customClass}`;
        if (hasBinding) className += ' vk-bound';
        if (isActive) className += ' vk-active';
        if (isBindingMode) className += ' vk-bind-mode-hover';

        return (
            <div
                key={keyChar}
                className={className}
                onClick={() => onBindKey(keyLower)}
                title={hasBinding ? `Bound to: ${binding.name}` : 'Unbound'}
            >
                <span className="vk-key-char">{keyChar === ' ' ? 'SPACE' : keyChar}</span>
                {hasBinding && (
                    <span className="vk-key-binding-name">
                        {binding.name}
                    </span>
                )}
            </div>
        );
    };

    return (
        <div className="visual-keyboard-wrapper">
            <div className="visual-keyboard">
                {ROWS.map((row, i) => (
                    <div key={i} className={`vk-row vk-row-indent-${i}`}>{row.map(k => renderKey(k))}</div>
                ))}
                <div className="vk-row">
                    {renderKey(' ', 'vk-spacebar')}
                </div>
            </div>

            <div className="visual-numpad">
                <div className="vk-numpad-title">NUMPAD</div>
                {NUMPAD.map((row, i) => (
                    <div key={i} className="vk-row">
                        {row.map(k => renderKey(k, k === '0' ? 'vk-numpad-zero' : ''))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VisualKeyboard;
