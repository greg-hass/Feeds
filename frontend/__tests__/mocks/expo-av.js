export const InterruptionModeAndroid = {
    DoNotMix: 'DoNotMix',
};

export const InterruptionModeIOS = {
    DoNotMix: 'DoNotMix',
};

const sound = {
    unloadAsync: async () => {},
    pauseAsync: async () => {},
    playAsync: async () => {},
    stopAsync: async () => {},
    setPositionAsync: async () => {},
    setRateAsync: async () => {},
    setVolumeAsync: async () => {},
    setIsMutedAsync: async () => {},
};

export const Audio = {
    setAudioModeAsync: async () => {},
    Sound: {
        createAsync: async () => ({ sound }),
    },
};
