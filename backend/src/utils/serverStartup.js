const listenAfterRecovery = async (recover, listen) => {
    await recover();
    return listen();
};

module.exports = { listenAfterRecovery };
