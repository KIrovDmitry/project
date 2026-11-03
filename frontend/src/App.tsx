import { useState, useEffect } from 'react';
import { Network, Experiment } from './types';
import { NetworkGeneratorTab } from './components/NetworkGeneratorTab';
import { NetworkAnalyzerTab } from './components/NetworkAnalyzerTab';
import { LpnExperimentsTab } from './components/LpnExperimentsTab';

export default function App() {
  const [activeTab, setActiveTab] = useState<'generator' | 'analyzer' | 'experiments'>('generator');
  const [networks, setNetworks] = useState<Network[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      const netRes = await fetch('/api/networks');
      if (netRes.ok) {
        const netData = await netRes.json();
        setNetworks(netData);
      }
      
      const expRes = await fetch('/api/experiments');
      if (expRes.ok) {
        const expData = await expRes.json();
        setExperiments(expData);
      }
    } catch (err) {
      console.error('Failed to connect to backend api:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleGenerateNetwork = async (formData: any) => {
    if (formData === null) {
      setIsLoading(true);
      await fetchData();
      setIsLoading(false);
      return null;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to generate network');
      }
      
      await fetchData();
      setIsLoading(false);
      return data;
    } catch (err) {
      setIsLoading(false);
      throw err;
    }
  };

  const handleDeleteNetwork = async (id: number) => {
    try {
      const res = await fetch(`/api/networks/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setNetworks((prev) => prev.filter((n) => n.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete network:', err);
    }
  };

  const [analysisProgress, setAnalysisProgress] = useState<{ current: number; total: number; message: string } | null>(null);
  const [experimentProgress, setExperimentProgress] = useState<{ current: number; total: number; message: string } | null>(null);

  const readProgressStream = async (
    res: Response,
    onProgress: (progress: { current: number; total: number; message: string }) => void,
    onSuccess: (data: any) => void
  ) => {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const step = JSON.parse(line);
              if (step.type === 'progress') {
                onProgress({
                  current: (step.index ?? 0) + 1,
                  total: step.total ?? 100,
                  message: step.message || '',
                });
              } else if (step.type === 'success') {
                onSuccess(step.results);
              }
            } catch (err) {
              console.error('Error parsing stream line:', err);
            }
          }
        }
      }
      if (buffer.trim()) {
        try {
          const step = JSON.parse(buffer);
          if (step.type === 'success') {
            onSuccess(step.results);
          }
        } catch (err) {}
      }
    }
  };

  const handleAnalyze = async (networkIds: number[], checkboxes: string[], threads: number) => {
    setIsLoading(true);
    setAnalysisProgress({ current: 0, total: networkIds.length, message: 'Инициализация анализа свойств...' });
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          network_ids: networkIds,
          checkboxes,
          threads,
        }),
      });
      
      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to analyze');
      }

      await readProgressStream(
        res,
        (prog) => setAnalysisProgress(prog),
        (results) => {}
      );
      
      await fetchData();
    } catch (err) {
      console.error('Failed to analyze:', err);
    } finally {
      setIsLoading(false);
      setAnalysisProgress(null);
    }
  };

  const handleAnalyzeAllUnanalyzed = async (checkboxes: string[], threads: number) => {
    setIsLoading(true);
    setAnalysisProgress({ current: 0, total: 100, message: 'Подготовка общего анализа нерассчитанных свойств...' });
    try {
      const queryParams = checkboxes.map((col) => `checkboxes=${col}`).join('&');
      const res = await fetch(`/api/analyze-all-unanalyzed?${queryParams}&threads=${threads}`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to analyze uncalculated');
      }

      await readProgressStream(
        res,
        (prog) => setAnalysisProgress(prog),
        (results) => {}
      );

      await fetchData();
    } catch (err) {
      console.error('Failed to analyze all uncalculated:', err);
    } finally {
      setIsLoading(false);
      setAnalysisProgress(null);
    }
  };

  const handleRunExperiment = async (formData: any) => {
    setIsLoading(true);
    setExperimentProgress({ current: 0, total: 100, message: 'Запуск серий экспериментов...' });
    try {
      const res = await fetch('/api/run_experiment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        throw new Error(await res.text() || 'Failed to run experiment');
      }

      let finalResults: any = null;
      await readProgressStream(
        res,
        (prog) => setExperimentProgress(prog),
        (results) => {
          finalResults = results;
        }
      );
      
      await fetchData();
      setIsLoading(false);
      setExperimentProgress(null);
      return finalResults;
    } catch (err) {
      setIsLoading(false);
      setExperimentProgress(null);
      throw err;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f7f6] text-[#2c3e50] font-sans p-4 sm:p-8">
      <nav className="flex flex-wrap gap-2 mb-6 bg-[#2c3e50] p-3 rounded-xl shadow-md font-sans">
        <button
          type="button"
          onClick={() => setActiveTab('generator')}
          className={`px-4 py-2 text-xs uppercase font-bold cursor-pointer tracking-wider rounded-lg transition-all duration-150 border-none ${
            activeTab === 'generator'
              ? 'bg-[#3498db] text-white shadow-sm'
              : 'text-gray-300 hover:bg-[#34495e] hover:text-white bg-transparent'
          }`}
        >
          1. Генератор
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('analyzer')}
          className={`px-4 py-2 text-xs uppercase font-bold cursor-pointer tracking-wider rounded-lg transition-all duration-150 border-none ${
            activeTab === 'analyzer'
              ? 'bg-[#3498db] text-white shadow-sm'
              : 'text-gray-300 hover:bg-[#34495e] hover:text-white bg-transparent'
          }`}
        >
          2. Анализ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('experiments')}
          className={`px-4 py-2 text-xs uppercase font-bold cursor-pointer tracking-wider rounded-lg transition-all duration-150 border-none ${
            activeTab === 'experiments'
              ? 'bg-[#3498db] text-white shadow-sm'
              : 'text-gray-300 hover:bg-[#34495e] hover:text-white bg-transparent'
          }`}
        >
          3. Изучение заторов
        </button>
      </nav>

      <main className="flex-grow bg-white border border-[#eee] p-6 rounded-xl shadow-sm">
        {activeTab === 'generator' && (
          <NetworkGeneratorTab
            networks={networks}
            isLoading={isLoading}
            onGenerate={handleGenerateNetwork}
            onDelete={handleDeleteNetwork}
          />
        )}
        {activeTab === 'analyzer' && (
          <NetworkAnalyzerTab
            networks={networks}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
            onAnalyzeAllUnanalyzed={handleAnalyzeAllUnanalyzed}
            progress={analysisProgress}
            onSaveAveragedCompleted={fetchData}
          />
        )}
        {activeTab === 'experiments' && (
          <LpnExperimentsTab
            experiments={experiments}
            isLoading={isLoading}
            onRunExperiment={handleRunExperiment}
            progress={experimentProgress}
          />
        )}
      </main>
    </div>
  );
}
