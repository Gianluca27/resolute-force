import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import App from './App';
it('renders the Resolute Force wordmark', () => {
    render(_jsx(App, {}));
    expect(screen.getByText(/resolute/i)).toBeInTheDocument();
});
//# sourceMappingURL=App.test.js.map