const WorkerPlugin = require('worker-plugin');

module.exports = {
    webpack: function (config, env) {
        // The GAN SDK ships optional chaining, which CRA 4's Webpack parser
        // cannot read even when our target browser supports it.
        config.module.rules.unshift({
            test: /gan-web-bluetooth[/\\]dist[/\\]esm[/\\].*\.mjs$/,
            type: 'javascript/auto', // SDK imports the CommonJS aes-js module
            use: { loader: 'babel-loader', options: {
                babelrc: false, configFile: false,
                plugins: ['@babel/plugin-proposal-optional-chaining']
            } }
        });
        config.plugins.push(
            new WorkerPlugin()
        )
        return config;
    }
}