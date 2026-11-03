import React, { useState } from 'react';
import { Network } from '../types';
import { NetworkVisualizer3D } from './NetworkVisualizer3D';
import { RotateCw, Trash2, HelpCircle } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface GeneratorTabProps {
  networks: Network[];
  isLoading: boolean;
  onGenerate: (data: any) => Promise<any>;
  onDelete: (id: number) => Promise<void>;
}

export const NetworkGeneratorTab: React.FC<GeneratorTabProps> = ({
  networks,
  isLoading,
  onGenerate,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    name: 'id = n',
    model_type: 'lpn',
    er_p: 0.05,
    ba_m: 2,
    N: 300,
    C: 1.0,
    alpha: 0.5,
    lambda_val: 0.05,
    input_mode: 'lambda',
    space_type: 'cube',
    distribution_type: 'random',
    node_link_int: true,
    nodes_as_points: true,
    single_vertex_set: false,
    x_range_min: 0.0,
    x_range_max: 1.0,
    y_range_min: 0.0,
    y_range_max: 1.0,
    z_range_min: 0.0,
    z_range_max: 1.0,
    count: 1,
    threads: 8,
    range_enabled: false,
    n_from: 100,
    n_to: 300,
    n_step: 100,
    param_from: 0.1,
    param_to: 0.2,
    param_step: 0.05,
    
    c_from: 0.1,
    c_to: 1.0,
    c_step: 0.1,
    
    lambda_from: 0.01,
    lambda_to: 0.1,
    lambda_step: 0.01,
    
    er_p_from: 0.01,
    er_p_to: 0.1,
    er_p_step: 0.01,
    
    ba_m_from: 1,
    ba_m_to: 10,
    ba_m_step: 2,
    
    alpha_from: 0.1,
    alpha_to: 0.5,
    alpha_step: 0.1,
    spaces: ['cube'] as string[],
    distributions: ['random'] as string[],
  });

  const [stringInputs, setStringInputs] = useState<Record<string, string>>({});

  const handleStringChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDuplicateWarnings([]);
    const { name, value } = e.target;
    
    setStringInputs(prev => ({
      ...prev,
      [name]: value
    }));
    
    const integerFields = ['N', 'ba_m', 'count', 'threads', 'n_from', 'n_to', 'n_step', 'ba_m_from', 'ba_m_to', 'ba_m_step'];
    
    let parsed: number;
    if (integerFields.includes(name)) {
      parsed = parseInt(value, 10);
    } else {
      parsed = parseFloat(value);
    }
    
    if (!isNaN(parsed)) {
      setFormData(prev => ({
        ...prev,
        [name]: parsed
      }));
    } else if (value === '') {
      setFormData(prev => ({
        ...prev,
        [name]: 0
      }));
    }
  };

  const [selectedNetwork, setSelectedNetwork] = useState<Network | null>(null);
  const [visualData, setVisualData] = useState<{ nodes: number[][]; links: number[][] } | null>(null);
  const [lastGeneratedInfo, setLastGeneratedInfo] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'ranges' | 'single_p'>('form');
  const [generationLogs, setGenerationLogs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeProgress, setActiveProgress] = useState<{ current: number; total: number } | null>(null);
  const [duplicateWarnings, setDuplicateWarnings] = useState<Network[]>([]);

  const handleSelectNetwork = (net: Network) => {
    setSelectedNetwork(net);
    setVisualData(null);
    fetch(`/api/networks/${net.id}/details`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        setVisualData(data);
      })
      .catch((_) => {
        console.error('Failed to fetch details for network');
      });
  };

  const handleSpaceCheckboxChange = (space: string, checked: boolean) => {
    setDuplicateWarnings([]);
    setFormData((prev) => {
      const nextSpaces = checked
        ? [...prev.spaces, space]
        : prev.spaces.filter((s) => s !== space);
      return { ...prev, spaces: nextSpaces };
    });
  };

  const handleDistCheckboxChange = (dist: string, checked: boolean) => {
    setDuplicateWarnings([]);
    setFormData((prev) => {
      const nextDists = checked
        ? [...prev.distributions, dist]
        : prev.distributions.filter((d) => d !== dist);
      return { ...prev, distributions: nextDists };
    });
  };

  const computedLambda = formData.input_mode === 'c_alpha' 
    ? (formData.C / Math.pow(formData.N, formData.alpha))
    : formData.lambda_val;

  const estimateMaxNodes = (d: number, space: string, dist: string): number => {
    if (!d || d <= 0) return 200000;
    let nMax = 200000;
    if (dist.startsWith('fractal')) {
      nMax = Math.floor(0.045 / (d * d));
    } else {
      if (dist === 'gaussian') {
        nMax = Math.floor(0.125 / (d * d * d));
      } else {
        nMax = Math.floor(0.735 / (d * d * d));
      }
    }
    return Math.max(3, nMax);
  };

  const maxRecommendedNodes = estimateMaxNodes(computedLambda, formData.space_type, formData.distribution_type);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setDuplicateWarnings([]);
    const { name, value, type } = e.target;
    let parsedValue: any = value;
    
    if (type === 'number') {
      parsedValue = parseFloat(value);
      if (isNaN(parsedValue)) parsedValue = 0;
    } else if (type === 'checkbox') {
      parsedValue = (e.target as HTMLInputElement).checked;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: parsedValue,
    }));
  };

  const handleModeToggle = (mode: 'c_alpha' | 'lambda') => {
    setDuplicateWarnings([]);
    setFormData((prev) => ({
      ...prev,
      input_mode: mode,
    }));
  };

  const getPlannedJobs = () => {
    const jobs: Array<{
      N: number;
      model_type: string;
      space_type: string;
      distribution_type: string;
      er_p?: number;
      ba_m?: number;
      C?: number;
      alpha?: number;
      lambda?: number;
    }> = [];

    const spaces = formData.range_enabled 
      ? (formData.spaces.length > 0 ? formData.spaces : [formData.space_type])
      : [formData.space_type];

    const distributions = formData.range_enabled
      ? (formData.distributions.length > 0 ? formData.distributions : [formData.distribution_type])
      : [formData.distribution_type];

    if (formData.range_enabled) {
      const n_step = formData.n_step && formData.n_step > 0 ? formData.n_step : 50;
      const n_vals: number[] = [];
      let curr_n = formData.n_from;
      while (curr_n <= formData.n_to) {
        n_vals.push(curr_n);
        curr_n += n_step;
        if (n_vals.length >= 5000) break;
      }

      let p_from = 0.1;
      let p_to = 0.5;
      let p_step_val = 0.1;

      if (formData.model_type === 'lpn') {
        if (formData.input_mode === 'c_alpha') {
          p_from = formData.c_from;
          p_to = formData.c_to;
          p_step_val = formData.c_step;
        } else {
          p_from = formData.lambda_from;
          p_to = formData.lambda_to;
          p_step_val = formData.lambda_step;
        }
      } else if (formData.model_type === 'er') {
        p_from = formData.er_p_from;
        p_to = formData.er_p_to;
        p_step_val = formData.er_p_step;
      } else if (formData.model_type === 'ba') {
        p_from = formData.ba_m_from;
        p_to = formData.ba_m_to;
        p_step_val = formData.ba_m_step;
      }

      const p_step = p_step_val && p_step_val > 0 ? p_step_val : 0.01;
      const p_vals: number[] = [];
      let curr_p = p_from;
      while (curr_p <= p_to + 1e-9) {
        p_vals.push(Number(curr_p.toFixed(5)));
        curr_p += p_step;
        if (p_vals.length >= 5000) break;
      }

      if (formData.model_type === 'lpn') {
        const alpha_vals: number[] = [];
        if (formData.input_mode === 'c_alpha') {
          const a_step = formData.alpha_step && formData.alpha_step > 0 ? formData.alpha_step : 0.1;
          let curr_a = formData.alpha_from;
          while (curr_a <= formData.alpha_to + 1e-9) {
            alpha_vals.push(Number(curr_a.toFixed(5)));
            curr_a += a_step;
            if (alpha_vals.length >= 5000) break;
          }
        } else {
          alpha_vals.push(formData.alpha);
        }

        for (const sp of spaces) {
          for (const dt of distributions) {
            for (const n of n_vals) {
              for (const p of p_vals) {
                for (const al of alpha_vals) {
                  if (formData.input_mode === 'c_alpha') {
                    const computed_lam = p / Math.pow(n, al);
                    jobs.push({
                      N: n,
                      model_type: 'lpn',
                      space_type: sp,
                      distribution_type: dt,
                      C: p,
                      alpha: al,
                      lambda: computed_lam,
                    });
                  } else {
                    jobs.push({
                      N: n,
                      model_type: 'lpn',
                      space_type: sp,
                      distribution_type: dt,
                      C: formData.C,
                      alpha: al,
                      lambda: p,
                    });
                  }
                }
              }
            }
          }
        }
      } else if (formData.model_type === 'er') {
        for (const n of n_vals) {
          for (const p of p_vals) {
            jobs.push({
              N: n,
              model_type: 'er',
              space_type: 'cube',
              distribution_type: 'random',
              er_p: p,
            });
          }
        }
      } else if (formData.model_type === 'ba') {
        for (const n of n_vals) {
          for (const p of p_vals) {
            jobs.push({
              N: n,
              model_type: 'ba',
              space_type: 'cube',
              distribution_type: 'random',
              ba_m: p,
            });
          }
        }
      }
    } else {
      for (let i = 0; i < formData.count; i++) {
        if (formData.model_type === 'lpn') {
          if (formData.input_mode === 'c_alpha') {
            const computed_lam = formData.C / Math.pow(formData.N, formData.alpha);
            jobs.push({
              N: formData.N,
              model_type: 'lpn',
              space_type: formData.space_type,
              distribution_type: formData.distribution_type,
              C: formData.C,
              alpha: formData.alpha,
              lambda: computed_lam,
            });
          } else {
            jobs.push({
              N: formData.N,
              model_type: 'lpn',
              space_type: formData.space_type,
              distribution_type: formData.distribution_type,
              C: formData.C,
              alpha: formData.alpha,
              lambda: formData.lambda_val,
            });
          }
        } else if (formData.model_type === 'er') {
          jobs.push({
            N: formData.N,
            model_type: 'er',
            space_type: 'cube',
            distribution_type: 'random',
            er_p: formData.er_p,
          });
        } else if (formData.model_type === 'ba') {
          jobs.push({
            N: formData.N,
            model_type: 'ba',
            space_type: 'cube',
            distribution_type: 'random',
            ba_m: formData.ba_m,
          });
        }
      }
    }

    return jobs;
  };

  const findDuplicateNetworks = () => {
    const planned = getPlannedJobs();
    const duplicates: Network[] = [];

    for (const job of planned) {
      const found = networks.find((net) => {
        const netType = net.model_type || 'lpn';
        if (netType !== job.model_type) return false;
        if (net.N !== job.N) return false;

        if (netType === 'lpn') {
          if (net.space_type !== job.space_type) return false;
          if (net.distribution_type !== job.distribution_type) return false;

          const diffC = Math.abs((net.C ?? 0) - (job.C ?? 0));
          const diffAlpha = Math.abs((net.alpha ?? 0) - (job.alpha ?? 0));
          const diffLambda = Math.abs((net.lambda ?? 0) - (job.lambda ?? 0));

          if (diffC > 1e-4 || diffAlpha > 1e-4 || diffLambda > 1e-4) return false;
        } else if (netType === 'er') {
          if (Math.abs((net.er_p ?? 0) - (job.er_p ?? 0)) > 1e-5) return false;
        } else if (netType === 'ba') {
          if (net.ba_m !== job.ba_m) return false;
        }

        return true;
      });

      if (found && !duplicates.some((d) => d.id === found.id)) {
        duplicates.push(found);
      }
    }

    return duplicates;
  };

  const handleGenerateStream = async (skipExisting: boolean = false) => {
    setIsGenerating(true);
    setGenerationLogs(['Установка соединения с сервером...']);
    setActiveProgress(null);
    setLastGeneratedInfo(null);

    try {
      if (formData.range_enabled) {
        if (formData.spaces.length === 0) {
          throw new Error('Выберите хотя бы одну область вложения для множественной генерации.');
        }
        if (formData.distributions.length === 0) {
          throw new Error('Выберите хотя бы одно распределение узлов для множественной генерации.');
        }
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, skip_existing: skipExisting }),
      });

      if (!res.ok) {
        const textLog = await res.text();
        throw new Error(textLog || 'Произошла непредвиденная ошибка на сервере');
      }

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
                if (step.type === 'log') {
                  setGenerationLogs((prev) => [...prev.slice(-150), step.message]);
                  if (step.index && step.total) {
                    setActiveProgress({ current: step.index, total: step.total });
                  }
                } else if (step.type === 'success') {
                  setGenerationLogs((prev) => [...prev.slice(-150), step.message]);
                } else if (step.type === 'summary') {
                  setLastGeneratedInfo(step.message);
                  setGenerationLogs((prev) => [...prev, `🎉 ${step.message}`]);
                }
              } catch (err) {
                console.error('Error parsing streaming line:', line);
              }
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          const step = JSON.parse(buffer);
          if (step.type === 'summary') {
            setLastGeneratedInfo(step.message);
          }
        } catch (e) {}
      }

      await onGenerate(null);

    } catch (err: any) {
      setGenerationLogs((prev) => [...prev, `❌ Ошибка генерации: ${err.message}`]);
    } finally {
      setIsGenerating(false);
      setActiveProgress(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const dups = findDuplicateNetworks();
    if (dups.length > 0) {
      setDuplicateWarnings(dups);
      return;
    }
    await handleGenerateStream();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-[#2c3e50] font-sans">
      <div className="lg:col-span-5 bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm">
        <h2 className="text-sm font-bold text-[#2c3e50] uppercase tracking-wider mb-4 pb-2 border-b border-[#eee] flex items-center gap-2">
          <span>Режимы построения LPN</span>
        </h2>

        <div className="flex border-b border-gray-200 mb-4 text-xs font-bold uppercase">
          <button
            type="button"
            onClick={() => {
              setActiveTab('form');
              setDuplicateWarnings([]);
              setFormData((prev) => ({ 
                ...prev, 
                range_enabled: false,
                single_vertex_set: false,
                count: 1
              }));
            }}
            className={`pb-2 px-3 transition-colors duration-155 border-b-2 border-transparent ${
              activeTab === 'form'
                ? 'border-[#3498db] text-[#3498db]'
                : 'text-gray-500 hover:text-black hover:bg-gray-50'
            }`}
          >
            Одиночная генерация
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('single_p');
              setDuplicateWarnings([]);
              setFormData((prev) => ({ 
                ...prev, 
                range_enabled: false,
                single_vertex_set: true,
                count: 10
              }));
            }}
            className={`pb-2 px-3 transition-colors duration-155 border-b-2 border-transparent ${
              activeTab === 'single_p'
                ? 'border-[#3498db] text-[#3498db]'
                : 'text-gray-500 hover:text-black hover:bg-gray-50'
            }`}
          >
            Генерация для одного P
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ranges');
              setDuplicateWarnings([]);
              setFormData((prev) => ({ 
                ...prev, 
                range_enabled: true 
              }));
            }}
            className={`pb-2 px-3 transition-colors duration-155 border-b-2 border-transparent ${
              activeTab === 'ranges'
                ? 'border-[#3498db] text-[#3498db]'
                : 'text-gray-500 hover:text-black hover:bg-gray-50'
            }`}
          >
            Множественная генерация
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-semibold">
          <div>
            <label className="block text-xs uppercase font-bold text-gray-500 mb-1 flex items-center">
              <span>Название серии сетей</span>
              <InfoTooltip text="Формирует базовое имя сети. Псевдоним 'id = n' автоматически заменяется индивидуальным идентификатором." />
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50 focus:border-[#3498db] transition-all shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-bold text-gray-700 mb-1 flex items-center">
              <span>Модель построения сети</span>
              <InfoTooltip text="Связи накладываются по правилу физических пространственных пересечений (LPN), случайным образом (ER) или по закону предпочтительного присоединения (BA)." />
            </label>
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-1 border border-gray-200 rounded-lg shadow-inner">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ 
                  ...prev, 
                  model_type: 'lpn', 
                  name: prev.name === 'Серия ER' || prev.name === 'Серия BA' || prev.name === 'Серия LPN' ? 'id = n' : prev.name 
                }))}
                className={`py-1.5 text-xs font-bold rounded-md transition-all border-none cursor-pointer ${
                  formData.model_type === 'lpn'
                    ? 'bg-[#3498db] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Модель LPN
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ 
                  ...prev, 
                  model_type: 'er', 
                  name: prev.name === 'id = n' || prev.name === 'Серия LPN' || prev.name === 'Серия BA' ? 'Серия ER' : prev.name 
                }))}
                className={`py-1.5 text-xs font-bold rounded-md transition-all border-none cursor-pointer ${
                  formData.model_type === 'er'
                    ? 'bg-[#3498db] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Эрдеша-Реньи (ER)
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ 
                  ...prev, 
                  model_type: 'ba', 
                  name: prev.name === 'id = n' || prev.name === 'Серия LPN' || prev.name === 'Серия ER' ? 'Серия BA' : prev.name 
                }))}
                className={`py-1.5 text-xs font-bold rounded-md transition-all border-none cursor-pointer ${
                  formData.model_type === 'ba'
                    ? 'bg-[#3498db] text-white shadow-xs'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                Барабаши-Альберта (BA)
              </button>
            </div>
          </div>

          {(activeTab === 'form' || activeTab === 'single_p') ? (
            <>
              <div>
                <label className="block text-xs uppercase font-bold text-gray-700 mb-1 flex items-center">
                  <span>Кол-во вершин (N)</span>
                  <InfoTooltip text="Количество генерируемых центров сфер в выбранной ограниченной 3D локализации." />
                </label>
                <input
                  type="text"
                  name="N"
                  value={stringInputs.N ?? formData.N ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={handleStringChange}
                  className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono font-bold rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50 focus:border-[#3498db] transition-all shadow-sm"
                />
                
                {formData.model_type === 'lpn' && (
                  <div className="mt-2 p-2.5 rounded-lg border text-[11px] leading-relaxed bg-gray-50/50 border-gray-200">
                    <div className="flex justify-between items-center mb-1 text-gray-700 font-mono font-bold">
                      <span className="font-semibold text-[10px] uppercase text-gray-500">Лимит вместимости:</span>
                      <span className="font-bold text-gray-900">
                        {formData.nodes_as_points ? 'бесконечность' : `${maxRecommendedNodes === Infinity ? 'бесконечность' : `${maxRecommendedNodes} вершин`}`}
                      </span>
                    </div>
                    {(!formData.nodes_as_points && maxRecommendedNodes !== Infinity && formData.N > maxRecommendedNodes) ? (
                      <div className="text-amber-700 bg-amber-50 border-amber-100 border px-2 py-0.5 rounded font-bold text-[10px]">
                        ⚠️ Возможен длительный расчет (N больше лимита вместимости).
                      </div>
                    ) : (
                      <div className="text-emerald-700 bg-emerald-50 border-emerald-100 border px-2 py-0.5 rounded font-bold text-[10px]">
                        ✓ Допустимое кол-во вершин.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {formData.model_type === 'lpn' && (
                <div>
                  <label className="block text-xs uppercase font-bold text-gray-700 mb-1">
                    Режим задания параметров физичности
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 border border-gray-200 rounded-lg shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleModeToggle('lambda')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all border-none cursor-pointer ${
                        formData.input_mode === 'lambda'
                          ? 'bg-[#3498db] text-white shadow-xs'
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Параметр λ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeToggle('c_alpha')}
                      className={`py-1.5 text-xs font-bold rounded-md transition-all border-none cursor-pointer ${
                        formData.input_mode === 'c_alpha'
                          ? 'bg-[#3498db] text-white shadow-xs'
                          : 'text-gray-650 hover:bg-gray-200'
                      }`}
                    >
                      Параметры C + α
                    </button>
                  </div>
                </div>
              )}

              {formData.model_type === 'lpn' && (
                formData.input_mode === 'c_alpha' ? (
                  <div className="grid grid-cols-2 gap-3 bg-gray-50 p-2.5 border border-dashed border-gray-300 rounded-lg">
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                        Константа С
                      </label>
                      <input
                        type="text"
                        name="C"
                        value={stringInputs.C ?? formData.C ?? ''}
                        onFocus={(e) => e.target.select()}
                        onChange={handleStringChange}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">
                        α
                      </label>
                      <input
                        type="text"
                        name="alpha"
                        value={stringInputs.alpha ?? formData.alpha ?? ''}
                        onFocus={(e) => e.target.select()}
                        onChange={handleStringChange}
                        className="w-full bg-white border border-gray-300 rounded-lg px-2 py-1 text-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 p-2.5 border border-dashed border-gray-300 rounded-lg">
                    <label className="block text-xs uppercase font-bold text-gray-600 mb-1">
                      Ширина λ
                    </label>
                    <input
                      type="text"
                      name="lambda_val"
                      value={stringInputs.lambda_val ?? formData.lambda_val ?? ''}
                      onFocus={(e) => e.target.select()}
                      onChange={handleStringChange}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                    />
                  </div>
                )
              )}

              {formData.model_type === 'er' && (
                <div className="bg-gray-50 p-2.5 border border-dashed border-gray-300 rounded-lg">
                  <label className="block text-xs uppercase font-bold text-gray-700 mb-1">
                    Вероятность связи (p)
                  </label>
                  <input
                    type="text"
                    name="er_p"
                    value={stringInputs.er_p ?? formData.er_p ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={handleStringChange}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                  />
                  <span className="block text-[10px] text-gray-550 mt-1 leading-tight font-bold">
                    Каждая из N*(N-1)/2 возможных связей создается независимо с вероятностью p.
                  </span>
                </div>
              )}

              {formData.model_type === 'ba' && (
                <div className="bg-gray-50 p-2.5 border border-dashed border-gray-300 rounded-lg">
                  <label className="block text-xs uppercase font-bold text-gray-700 mb-1">
                    Число связей на новый узел (m)
                  </label>
                  <input
                    type="text"
                    name="ba_m"
                    value={stringInputs.ba_m ?? formData.ba_m ?? ''}
                    onFocus={(e) => e.target.select()}
                    onChange={handleStringChange}
                    className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-black font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                  />
                  <span className="block text-[10px] text-gray-550 mt-1 leading-tight font-bold">
                    При добавлении очередного узла он подсоединяется к m существующим узлам по принципу предпочтительного присоединения.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-1">
                  Область вложения сети
                </label>
                <select
                  name="space_type"
                  value={formData.space_type}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-bold text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                >
                  <option value="cube">Единичный куб</option>
                  <option value="sphere">Шар</option>
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase font-bold text-gray-500 mb-1">
                  Распределение узлов
                </label>
                <select
                  name="distribution_type"
                  value={formData.distribution_type}
                  onChange={handleChange}
                  className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-bold text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-[#3498db]/50"
                >
                  <option value="random">Случайное</option>
                  <option value="gaussian">Гауссово</option>
                  <option value="grid">Сетка с малым шумом</option>
                  <option value="fractal_tetrahedron">Фрактал: Тетраэдр Серпинского (в кубе)</option>
                  <option value="fractal_tetrahedron_cropped">Фрактал: Тетраэдр Серпинского (вырезан)</option>
                  <option value="fractal_octahedron">Фрактал: Октаэдр Серпинского (в кубе)</option>
                  <option value="fractal_octahedron_cropped">Фрактал: Октаэдр Серпинского (вырезан)</option>
                  <option value="fractal_menger">Фрактал: Губка Менгера</option>
                  <option value="fractal_cube">Фрактал: Канторова пыль</option>
                </select>
              </div>
            </>
          ) : (
            <div className="space-y-4 bg-gray-50 p-3 border border-dashed border-gray-300 rounded-lg">
              <h3 className="text-xs font-bold text-black uppercase border-b border-gray-200 pb-1">
                Параметры серии генерации
              </h3>

              {formData.model_type === 'lpn' && (
                <div className="pb-2 border-b border-gray-150 mb-2">
                  <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">
                    Режим задания параметров физичности
                  </label>
                  <div className="grid grid-cols-2 gap-2 bg-white p-1 border border-gray-200 rounded-lg shadow-inner">
                    <button
                      type="button"
                      onClick={() => handleModeToggle('lambda')}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all border-0 cursor-pointer ${
                        formData.input_mode === 'lambda'
                          ? 'bg-[#3498db] text-white shadow-xs'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      Параметр λ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleModeToggle('c_alpha')}
                      className={`py-1 text-[10px] font-bold rounded-md transition-all border-0 cursor-pointer ${
                        formData.input_mode === 'c_alpha'
                          ? 'bg-[#3498db] text-white shadow-xs'
                          : 'text-gray-650 hover:bg-gray-100'
                      }`}
                    >
                      Параметры C + α
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">Кол-во вершин (N):</span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] text-gray-400">От (min)</label>
                    <input
                      type="number"
                      name="n_from"
                      min="3"
                      step="1"
                      value={formData.n_from}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400">До (max)</label>
                    <input
                      type="number"
                      name="n_to"
                      min="3"
                      step="1"
                      value={formData.n_to}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-400">Шаг N</label>
                    <input
                      type="number"
                      name="n_step"
                      min="1"
                      step="1"
                      value={formData.n_step}
                      onFocus={(e) => e.target.select()}
                      onWheel={(e) => e.currentTarget.blur()}
                      onChange={handleChange}
                      className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                    />
                  </div>
                </div>
              </div>

              {formData.model_type === 'lpn' && formData.input_mode === 'c_alpha' && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">
                    Интервал параметра C:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-400">От (min)</label>
                      <input
                        type="number"
                        name="c_from"
                        step="0.01"
                        value={formData.c_from}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">До (max)</label>
                      <input
                        type="number"
                        name="c_to"
                        step="0.01"
                        value={formData.c_to}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">Шаг C</label>
                      <input
                        type="number"
                        name="c_step"
                        step="0.01"
                        value={formData.c_step}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.model_type === 'lpn' && formData.input_mode === 'lambda' && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">
                    Интервал ширины λ:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-400">От (min)</label>
                      <input
                        type="number"
                        name="lambda_from"
                        step="0.001"
                        value={formData.lambda_from}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">До (max)</label>
                      <input
                        type="number"
                        name="lambda_to"
                        step="0.001"
                        value={formData.lambda_to}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">Шаг λ</label>
                      <input
                        type="number"
                        name="lambda_step"
                        step="0.001"
                        value={formData.lambda_step}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.model_type === 'er' && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">
                    Интервал вероятности связь (er_p):
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-400">От (min)</label>
                      <input
                        type="number"
                        name="er_p_from"
                        min="0.0001"
                        max="1"
                        step="0.01"
                        value={formData.er_p_from}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">До (max)</label>
                      <input
                        type="number"
                        name="er_p_to"
                        min="0.0001"
                        max="1"
                        step="0.01"
                        value={formData.er_p_to}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">Шаг p</label>
                      <input
                        type="number"
                        name="er_p_step"
                        min="0.0001"
                        max="1"
                        step="0.01"
                        value={formData.er_p_step}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.model_type === 'ba' && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">
                    Интервал числа связей (ba_m):
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-400">От (min)</label>
                      <input
                        type="number"
                        name="ba_m_from"
                        min="1"
                        step="1"
                        value={formData.ba_m_from}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">До (max)</label>
                      <input
                        type="number"
                        name="ba_m_to"
                        min="1"
                        step="1"
                        value={formData.ba_m_to}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">Шаг m</label>
                      <input
                        type="number"
                        name="ba_m_step"
                        min="1"
                        step="1"
                        value={formData.ba_m_step}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              {formData.model_type === 'lpn' && formData.input_mode === 'c_alpha' && (
                <div className="space-y-1">
                  <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">Диапазон α:</span>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[9px] text-gray-400">От (min)</label>
                      <input
                        type="number"
                        name="alpha_from"
                        step="0.01"
                        value={formData.alpha_from}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">До (max)</label>
                      <input
                        type="number"
                        name="alpha_to"
                        step="0.01"
                        value={formData.alpha_to}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[9px] text-gray-400">Шаг</label>
                      <input
                        type="number"
                        name="alpha_step"
                        step="0.01"
                        value={formData.alpha_step}
                        onFocus={(e) => e.target.select()}
                        onWheel={(e) => e.currentTarget.blur()}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-300 font-mono font-bold py-1 px-1.5 text-xs text-black rounded-md"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">Области вложения сети (выберите):</span>
                <div className="flex flex-wrap gap-4 mt-1 bg-white p-2.5 rounded-md border border-gray-200">
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={formData.spaces.includes('cube')}
                      onChange={(e) => handleSpaceCheckboxChange('cube', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                    <span>Куб</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs select-none">
                    <input
                      type="checkbox"
                      checked={formData.spaces.includes('sphere')}
                      onChange={(e) => handleSpaceCheckboxChange('sphere', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer h-3.5 w-3.5"
                    />
                    <span>Шар</span>
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <span className="block text-[10px] uppercase font-bold text-gray-500 font-bold">Распределения узлов (выберите):</span>
                <div className="grid grid-cols-2 gap-2 bg-white p-2.5 rounded-md border border-gray-200">
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('random')}
                      onChange={(e) => handleDistCheckboxChange('random', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Случайное</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('gaussian')}
                      onChange={(e) => handleDistCheckboxChange('gaussian', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Гауссово</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none text-[#2c3e50]">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('grid')}
                      onChange={(e) => handleDistCheckboxChange('grid', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Сетка</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_tetrahedron')}
                      onChange={(e) => handleDistCheckboxChange('fractal_tetrahedron', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Тетраэдр (в кубе)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_tetrahedron_cropped')}
                      onChange={(e) => handleDistCheckboxChange('fractal_tetrahedron_cropped', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Тетраэдр (вырезан)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_octahedron')}
                      onChange={(e) => handleDistCheckboxChange('fractal_octahedron', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Октаэдр (в кубе)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_octahedron_cropped')}
                      onChange={(e) => handleDistCheckboxChange('fractal_octahedron_cropped', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Октаэдр (вырезан)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_menger')}
                      onChange={(e) => handleDistCheckboxChange('fractal_menger', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Губка Менгера</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] select-none">
                    <input
                      type="checkbox"
                      checked={formData.distributions.includes('fractal_cube')}
                      onChange={(e) => handleDistCheckboxChange('fractal_cube', e.target.checked)}
                      className="rounded text-[#3498db] border-gray-300 focus:ring-0 cursor-pointer"
                    />
                    <span>Канторова пыль</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 font-bold">
            <input
              type="checkbox"
              id="node_link_int"
              name="node_link_int"
              checked={formData.node_link_int}
              onChange={handleChange}
              className="rounded text-[#3498db] border-gray-300 focus:ring-0 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="node_link_int" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
              Исключать пересечения вершин с ребрами
            </label>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="nodes_as_points"
              name="nodes_as_points"
              checked={formData.nodes_as_points}
              onChange={handleChange}
              className="rounded text-[#3498db] border-gray-300 focus:ring-0 h-4 w-4 cursor-pointer"
            />
            <label htmlFor="nodes_as_points" className="text-xs font-bold text-gray-600 cursor-pointer select-none">
              Вершины как точки (без диаметра)
            </label>
          </div>

          {activeTab === 'single_p' && (
            <div className="pt-2">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">
                Количество генераций (повторов)
              </label>
              <input
                type="text"
                name="count"
                value={stringInputs.count ?? formData.count ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={handleStringChange}
                className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono font-bold focus:outline-none rounded-lg"
              />
            </div>
          )}

          {(activeTab === 'single_p' || activeTab === 'ranges') && (
            <div className="pt-2">
              <label className="block text-xs uppercase font-bold text-gray-500 mb-1">
                Количество вычислительных потоков (1-16)
              </label>
              <input
                type="text"
                name="threads"
                value={stringInputs.threads ?? formData.threads ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={handleStringChange}
                className="w-full bg-white border border-gray-300 px-3 py-1.5 text-black font-mono font-bold focus:outline-none rounded-lg"
              />
            </div>
          )}

          {activeTab !== 'ranges' && (
            <div className="bg-gray-50 p-2.5 border border-gray-200 rounded-lg text-[11px] font-mono flex justify-between items-center text-blue-900 font-bold shadow-inner border-0">
              <span>Параметр λ (расчетный):</span>
              <span className="font-bold border-b border-blue-900">{computedLambda.toFixed(5)}</span>
            </div>
          )}

          {duplicateWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 p-3.5 rounded-lg text-amber-900 leading-normal space-y-2.5 shadow-sm">
              <div className="font-bold flex items-center gap-1.5 text-xs text-amber-800 uppercase tracking-wide">
                <span>⚠️ Сети уже существуют</span>
                <span className="bg-amber-100 px-1.5 py-0.5 rounded-full text-[10px] lowercase font-mono">
                  {duplicateWarnings.length} совп.
                </span>
              </div>
              <p className="text-[11px] font-medium leading-relaxed">
                Следующие графы с идентичными параметрами уже сгенерированы в БД:
              </p>
              <div className="max-h-[110px] overflow-y-auto border border-amber-200 bg-white/70 p-2 rounded text-[10px] font-semibold space-y-1 divide-y divide-amber-100 select-none">
                {duplicateWarnings.map((net) => (
                  <div key={net.id} className="pt-1.5 pb-1 flex justify-between gap-1 items-center">
                    <span className="truncate text-gray-800">
                      {net.name} {net.N ? `(N=${net.N})` : ''}
                    </span>
                    <span className="text-[9px] font-mono text-gray-400 shrink-0">
                      {net.created_at}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] font-bold">
                Вы действительно хотите продублировать генерацию для построения новых сетевых ансамблей?
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-bold">
                <button
                  type="button"
                  onClick={async () => {
                    setDuplicateWarnings([]);
                    await handleGenerateStream();
                  }}
                  className="bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold py-1.5 px-3 rounded-md text-[11px] text-center uppercase tracking-wide transition border-0 cursor-pointer shadow-sm"
                >
                  Да, сгенерировать дубликаты
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setDuplicateWarnings([]);
                    await handleGenerateStream(true);
                  }}
                  className="bg-white hover:bg-gray-100 text-gray-750 font-bold py-1.5 px-3 rounded-md text-[11px] text-center uppercase tracking-wide transition border border-gray-300 cursor-pointer shadow-sm"
                >
                  Сгенерировать новые (без дубликатов)
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating || isLoading || duplicateWarnings.length > 0}
            className="w-full bg-[#3498db] hover:bg-[#2980b9] active:bg-[#1d6fa5] disabled:bg-gray-300 disabled:text-gray-500 text-white font-bold py-2.5 px-4 transition rounded-lg shadow-sm flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider text-xs border-0"
          >
            {isGenerating || isLoading ? (
              <>
                <RotateCw className="animate-spin h-3.5 w-3.5" />
                Идет симуляция связей...
              </>
            ) : (
              'Запустить построение LPN'
            )}
          </button>
        </form>

        {generationLogs.length > 0 && (
          <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden bg-black shadow-lg">
            <div className="bg-gray-900 px-3 py-1.5 text-[9px] text-gray-400 font-bold flex justify-between items-center border-b border-gray-800">
              <span className="uppercase tracking-wider">Лог сборки серии (NDJSON Stream)</span>
              {activeProgress && (
                <span className="font-mono text-emerald-400 font-bold">
                  {Math.round((activeProgress.current / activeProgress.total) * 100)}% ({activeProgress.current}/{activeProgress.total})
                </span>
              )}
            </div>
            {activeProgress && (
              <div className="w-full bg-gray-800 h-1">
                <div 
                  className="bg-emerald-500 h-1 transition-all duration-200"
                  style={{ width: `${(activeProgress.current / activeProgress.total) * 100}%` }}
                />
              </div>
            )}
            <div className="p-3 max-h-[160px] overflow-y-auto font-mono text-[10px] space-y-1 text-emerald-400 font-bold">
              {generationLogs.map((logLine, i) => (
                <div key={i} className="leading-snug">
                  {logLine}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6">
        <div className="bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm text-black">
          <div className="flex justify-between items-center mb-4 border-b border-[#eee] pb-2">
            <div>
              <h3 className="text-base font-bold text-[#2c3e50] uppercase">
                {selectedNetwork ? `Визуализация: ${selectedNetwork.name}` : 'Визуализация'}
              </h3>
              <p className="text-xs text-gray-500 italic">
                {selectedNetwork 
                  ? `Узлов N = ${selectedNetwork.nodes_count}, связей M = ${selectedNetwork.links_count}${selectedNetwork.lambda != null ? `, λ = ${selectedNetwork.lambda.toFixed(5)}` : ''}${selectedNetwork.er_p != null ? `, p = ${selectedNetwork.er_p}` : ''}${selectedNetwork.ba_m != null ? `, m = ${selectedNetwork.ba_m}` : ''}` 
                  : 'Выберите сеть из локального реестра ниже для детального просмотра LPN.'}
              </p>
            </div>
          </div>

          {selectedNetwork ? (
            visualData ? (
              <NetworkVisualizer3D nodes={visualData.nodes} links={visualData.links} key={selectedNetwork.id} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-gray-300 bg-gray-50 rounded-xl text-gray-500 font-sans">
                <RotateCw className="animate-spin h-8 w-8 text-[#3498db] mb-2" />
                <p className="text-sm font-semibold">Идет чтение матрицы инцидентности из SQLite бд...</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] border border-dashed border-gray-300 bg-gray-50 rounded-xl text-gray-500 font-sans">
              <HelpCircle className="h-10 w-10 text-gray-400 mb-2" />
              <p className="text-sm font-semibold">Для отображения 3D модели сгенерируйте новые LPN или выберите отчетную строку снизу.</p>
            </div>
          )}
        </div>

        <div className="bg-white border border-[#e0e0e0] p-5 rounded-xl shadow-sm flex-grow text-[#2c3e50]">
          <h3 className="text-base font-bold text-[#2c3e50] uppercase mb-4 pb-2 border-b border-[#eee]">
            БД
          </h3>
          
          <div className="overflow-y-auto max-h-[300px] border border-gray-200 rounded-lg bg-white shadow-inner">
            {networks.length === 0 ? (
              <p className="text-xs text-gray-450 text-center py-8 italic font-bold">База данных пуста. Сгенерируйте новые сети в панели слева.</p>
            ) : (
              <table className="w-full text-xs text-left text-[#2c3e50] font-sans">
                <thead className="text-[10px] uppercase bg-[#2c3e50] text-[#fff] border-b border-gray-200 font-bold">
                  <tr>
                    <th className="px-4 py-2.5 border-r border-[#34495e]">Серия / Тип</th>
                    <th className="px-3 py-2.5 border-r border-[#34495e]">N / M</th>
                    <th className="px-3 py-2.5 border-r border-[#34495e]">Параметр (λ/p/m)</th>
                    <th className="px-3 py-2.5 border-r border-[#34495e]">M_phys / M_max</th>
                    <th className="px-3 py-2.5 border-r border-[#34495e]">L_total</th>
                    <th className="px-3 py-2.5 border-r border-[#34495e]">Анализ</th>
                    <th className="px-4 py-2.5 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {networks.map((net) => {
                    const isAnalyzed = Object.values(net.characteristics).every(c => c !== null);
                    return (
                      <tr
                        key={net.id}
                        onClick={() => handleSelectNetwork(net)}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors duration-100 ${
                          selectedNetwork?.id === net.id ? 'bg-[#f4f7f6] text-[#2c3e50] font-bold border-y border-[#3498db]' : ''
                        }`}
                      >
                        <td className="px-4 py-3 border-r border-gray-100 font-bold">
                          <div className="truncate max-w-[200px] font-bold text-[#2c3e50]">{net.name}</div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5 font-bold">
                            {net.space_type === 'cube' ? 'Куб' : net.space_type === 'sphere' ? 'Шар' : 'Фрак.'} • {net.distribution_type}
                          </div>
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono font-bold">
                          <span className="font-bold">{net.N}</span>
                          <span className="text-gray-400 font-bold"> / {net.links_count}</span>
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono font-bold text-[#3498db]">
                          {net.lambda != null
                            ? net.lambda.toFixed(5)
                            : net.er_p != null
                            ? `p=${net.er_p}`
                            : net.ba_m != null
                            ? `m=${net.ba_m}`
                            : '—'}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-[10px]">
                          {net.m_phys != null ? (
                            <div>
                              <span className="text-emerald-600 font-bold">{net.m_phys}</span>
                              <span className="text-gray-400"> / </span>
                              <span className="text-indigo-600 font-bold">{net.m_max}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-[10px]">
                          {net.l_total != null ? (
                            <span className="text-amber-600 font-bold">{net.l_total.toFixed(4)}</span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition ${
                            isAnalyzed
                              ? 'bg-[#f1fcf4] border-0 text-[#27ae60]'
                              : 'bg-[#fff9e6] border-0 text-[#b58900]'
                          }`}>
                            {isAnalyzed ? 'Да' : 'Нет'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onDelete(net.id)}
                            className="text-gray-400 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-md transition border-0 bg-transparent cursor-pointer"
                            title="Удалить сеть"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
