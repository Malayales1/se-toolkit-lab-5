import { useState, useEffect } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js'
import { Bar, Line } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
)

const STORAGE_KEY = 'api_key'
const LAB_OPTIONS = ['lab-01', 'lab-02', 'lab-03', 'lab-04', 'lab-05']

interface ScoresData {
  bucket: string
  count: number
}

interface TimelineData {
  date: string
  submissions: number
}

interface PassRatesData {
  task: string
  avg_score: number
  attempts: number
}

type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string }

function Dashboard() {
  const [selectedLab, setSelectedLab] = useState<string>(LAB_OPTIONS[0])
  const [scoresState, setScoresState] = useState<FetchState<ScoresData[]>>({
    status: 'idle',
  })
  const [timelineState, setTimelineState] = useState<
    FetchState<TimelineData[]>
  >({ status: 'idle' })
  const [passRatesState, setPassRatesState] = useState<
    FetchState<PassRatesData[]>
  >({ status: 'idle' })

  const token = localStorage.getItem(STORAGE_KEY) ?? ''
  const apiTarget = import.meta.env.VITE_API_TARGET

  useEffect(() => {
    if (!token) {
      setScoresState({ status: 'idle' })
      setTimelineState({ status: 'idle' })
      setPassRatesState({ status: 'idle' })
      return
    }

    const fetchScores = async () => {
      setScoresState({ status: 'loading' })
      try {
        const res = await fetch(
          `${apiTarget}/analytics/scores?lab=${selectedLab}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: ScoresData[] = await res.json()
        setScoresState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setScoresState({ status: 'error', message })
      }
    }

    const fetchTimeline = async () => {
      setTimelineState({ status: 'loading' })
      try {
        const res = await fetch(
          `${apiTarget}/analytics/timeline?lab=${selectedLab}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: TimelineData[] = await res.json()
        setTimelineState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setTimelineState({ status: 'error', message })
      }
    }

    const fetchPassRates = async () => {
      setPassRatesState({ status: 'loading' })
      try {
        const res = await fetch(
          `${apiTarget}/analytics/pass-rates?lab=${selectedLab}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: PassRatesData[] = await res.json()
        setPassRatesState({ status: 'success', data })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setPassRatesState({ status: 'error', message })
      }
    }

    fetchScores()
    fetchTimeline()
    fetchPassRates()
  }, [token, selectedLab, apiTarget])

  const scoresChartData = {
    labels: scoresState.status === 'success' ? scoresState.data.map((d) => d.bucket) : [],
    datasets: [
      {
        label: 'Submissions',
        data: scoresState.status === 'success' ? scoresState.data.map((d) => d.count) : [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  }

  const timelineChartData = {
    labels: timelineState.status === 'success' ? timelineState.data.map((d) => d.date) : [],
    datasets: [
      {
        label: 'Submissions per day',
        data: timelineState.status === 'success' ? timelineState.data.map((d) => d.submissions) : [],
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
      },
    ],
  }

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Score Buckets',
      },
    },
  }

  const lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Submissions Timeline',
      },
    },
  }

  if (!token) {
    return (
      <div className="dashboard">
        <h1>Dashboard</h1>
        <p>Please enter your API key in the main app to view analytics.</p>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="lab-selector">
        <label htmlFor="lab-select">Select Lab: </label>
        <select
          id="lab-select"
          value={selectedLab}
          onChange={(e) => setSelectedLab(e.target.value)}
        >
          {LAB_OPTIONS.map((lab) => (
            <option key={lab} value={lab}>
              {lab}
            </option>
          ))}
        </select>
      </div>

      <div className="charts-container">
        <div className="chart-section">
          <h2>Score Buckets</h2>
          {scoresState.status === 'loading' && <p>Loading...</p>}
          {scoresState.status === 'error' && (
            <p className="error">Error: {scoresState.message}</p>
          )}
          {scoresState.status === 'success' && (
            <Bar data={scoresChartData} options={barChartOptions} />
          )}
        </div>

        <div className="chart-section">
          <h2>Submissions Timeline</h2>
          {timelineState.status === 'loading' && <p>Loading...</p>}
          {timelineState.status === 'error' && (
            <p className="error">Error: {timelineState.message}</p>
          )}
          {timelineState.status === 'success' && (
            <Line data={timelineChartData} options={lineChartOptions} />
          )}
        </div>

        <div className="chart-section">
          <h2>Pass Rates</h2>
          {passRatesState.status === 'loading' && <p>Loading...</p>}
          {passRatesState.status === 'error' && (
            <p className="error">Error: {passRatesState.message}</p>
          )}
          {passRatesState.status === 'success' && (
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Average Score</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {passRatesState.data.map((item) => (
                  <tr key={item.task}>
                    <td>{item.task}</td>
                    <td>{item.avg_score.toFixed(2)}</td>
                    <td>{item.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default Dashboard
