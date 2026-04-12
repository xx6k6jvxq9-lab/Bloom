import { AnimatePresence, motion } from 'motion/react';
import { LoaderCircle, LocateFixed, PlusCircle, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type GroupLocationPayload = {
  name: string;
  address?: string;
  isVirtual?: boolean;
};

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

export function GroupLocationPickerSheet({
  isOpen,
  onClose,
  onSend,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSend: (location: GroupLocationPayload) => Promise<void> | void;
}) {
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [detectedLocation, setDetectedLocation] = useState<GroupLocationPayload | null>(null);
  const [customName, setCustomName] = useState('');
  const [customAddress, setCustomAddress] = useState('');
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsLocating(false);
      setLocationError('');
      setDetectedLocation(null);
      setCustomName('');
      setCustomAddress('');
      setIsSending(false);
    }
  }, [isOpen]);

  const customLocation = useMemo<GroupLocationPayload | null>(() => {
    const name = customName.trim();
    const address = customAddress.trim();
    if (!name) {
      return null;
    }

    return {
      name,
      address: address || undefined,
      isVirtual: true,
    };
  }, [customAddress, customName]);

  const handleSend = async (location: GroupLocationPayload) => {
    if (isSending) {
      return;
    }

    setIsSending(true);
    try {
      await onSend(location);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const handleLocate = () => {
    if (isLocating) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationError('当前环境不支持定位，请改用虚拟位置。');
      return;
    }

    setLocationError('');
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = formatCoordinate(position.coords.latitude);
        const longitude = formatCoordinate(position.coords.longitude);

        setDetectedLocation({
          name: '我的当前位置',
          address: `纬度 ${latitude}，经度 ${longitude}`,
          isVirtual: false,
        });
        setIsLocating(false);
      },
      () => {
        setLocationError('定位失败，请检查定位权限后重试。');
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      },
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="flex max-h-[88vh] w-full flex-col rounded-t-[32px] bg-white p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-[18px] font-bold text-zinc-900">发送位置</h3>
                <p className="mt-1 text-[13px] text-zinc-500">支持真实位置和自定义虚拟位置</p>
              </div>
              <button onClick={onClose} className="p-2 text-zinc-400 transition-colors hover:text-zinc-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pb-2">
              <section className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-800">
                    <LocateFixed size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">真实位置</div>
                    <div className="text-[12px] text-zinc-500">读取浏览器定位，发送你当前的真实坐标</div>
                  </div>
                </div>

                <button
                  onClick={handleLocate}
                  disabled={isLocating || isSending}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-zinc-200"
                >
                  {isLocating ? <LoaderCircle size={18} className="animate-spin" /> : <LocateFixed size={18} />}
                  {isLocating ? '定位中...' : '获取当前位置'}
                </button>

                {locationError && <div className="mt-3 text-[12px] text-rose-500">{locationError}</div>}

                {detectedLocation && (
                  <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-4">
                    <div className="text-sm font-semibold text-zinc-900">{detectedLocation.name}</div>
                    <div className="mt-1 text-[13px] text-zinc-500">{detectedLocation.address}</div>
                    <button
                      onClick={() => void handleSend(detectedLocation)}
                      disabled={isSending}
                      className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-zinc-200"
                    >
                      发送真实位置
                    </button>
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-zinc-100 bg-zinc-50/80 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-800">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">虚拟位置</div>
                    <div className="text-[12px] text-zinc-500">自定义显示名称和地址</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <label className="block">
                    <div className="mb-2 text-[12px] font-medium text-zinc-500">位置名称</div>
                    <input
                      value={customName}
                      onChange={(event) => setCustomName(event.target.value)}
                      placeholder="例如：公司楼下、机场、学校"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400"
                    />
                  </label>
                  <label className="block">
                    <div className="mb-2 text-[12px] font-medium text-zinc-500">地址描述</div>
                    <input
                      value={customAddress}
                      onChange={(event) => setCustomAddress(event.target.value)}
                      placeholder="例如：高新区天府大道 / 地铁口附近"
                      className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400"
                    />
                  </label>
                </div>

                <button
                  onClick={() => customLocation && void handleSend(customLocation)}
                  disabled={!customLocation || isSending}
                  className="mt-3 w-full rounded-2xl border border-zinc-200 bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-900 transition-colors disabled:cursor-not-allowed disabled:opacity-60 hover:bg-zinc-200"
                >
                  发送虚拟位置
                </button>
              </section>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
