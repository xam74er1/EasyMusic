import { useRef, useEffect } from 'react';
import { useSprings, animated } from '@react-spring/web';

const BlurText = ({
    text = '',
    delay = 50,
    className = '',
    animateBy = 'words',
    direction = 'top',
}) => {
    const elements = animateBy === 'words' ? text.split(' ') : text.split('');
    const ref = useRef();

    const [springs, api] = useSprings(elements.length, i => ({
        from: {
            filter: 'blur(10px)',
            opacity: 0,
            transform: direction === 'top' ? 'translateY(-50px)' : 'translateY(50px)',
        },
    }));

    useEffect(() => {
        api.start(i => ({
            to: [
                {
                    filter: 'blur(0px)',
                    opacity: 1,
                    transform: 'translateY(0)',
                },
                { filter: 'none' } // Removes filter completely after animation to fix blurry text
            ],
            delay: i * delay,
            config: { mass: 1, tension: 150, friction: 15 },
        }));
    }, [api, delay]);

    return (
        <span ref={ref} className={className} style={{ display: 'flex', flexWrap: 'wrap' }}>
            {springs.map((props, index) => (
                <animated.span
                    key={index}
                    style={{
                        ...props,
                        display: 'inline-block',
                    }}
                >
                    {elements[index] === ' ' ? '\u00A0' : elements[index]}
                    {animateBy === 'words' && index < elements.length - 1 && '\u00A0'}
                </animated.span>
            ))}
        </span>
    );
};

export default BlurText;
