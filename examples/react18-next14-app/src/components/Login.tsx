import React, { createContext, forwardRef, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const AuthContext = createContext<{ user: string | null }>({ user: null });

interface LoginProps {
  title?: string;
  onSubmit?: (user: string) => void;
}

export function Login({ title, onSubmit }: LoginProps) {
  const inputRef = useRef<HTMLInputElement>();
  const [user, setUser] = useState<string | null>(null);

  return (
    <AuthContext.Provider value={{ user }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = inputRef.current?.value ?? '';
          setUser(value);
          onSubmit?.(value);
        }}
      >
        <h2>{title}</h2>
        <FancyInput ref={inputRef} />
        <button type="submit">Sign in</button>
      </form>
    </AuthContext.Provider>
  );
}

Login.propTypes = {
  title: PropTypes.string,
  onSubmit: PropTypes.func,
};

Login.defaultProps = {
  title: 'Welcome back',
};

const FancyInput = forwardRef<HTMLInputElement>((props, ref) => (
  <input ref={ref} placeholder="username" {...props} />
));
FancyInput.displayName = 'FancyInput';
