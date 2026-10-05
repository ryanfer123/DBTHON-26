import { Route, Routes } from 'react-router'
import { WelcomePage } from './features/community/WelcomePage'

export function App() {
  return (
    <Routes>
      <Route path="/" element={<WelcomePage />} />
      <Route path="/community/:role" element={<WelcomePage />} />
      <Route path="*" element={
        <main className="not-found container">
          <h1>That table isn’t here.</h1>
          <p>The page you’re looking for couldn’t be found.</p>
          <a className="button" href="/">Back to Second Table</a>
        </main>
      } />
    </Routes>
  )
}
