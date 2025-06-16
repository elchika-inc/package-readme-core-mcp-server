import { PackageNamePatterns, ContextHintPatterns, ConfidenceCalculation, ParallelExecutionStrategy } from '../types/index.js';

export const PACKAGE_NAME_PATTERNS: PackageNamePatterns = {
  npm: [
    /^@[a-z0-9-~][a-z0-9-._~]*\/[a-z0-9-~][a-z0-9-._~]*$/,
    /^[a-z0-9-~][a-z0-9-._~]*$/
  ],
  composer: [
    /^[a-z0-9]([_.-]?[a-z0-9]+)*\/[a-z0-9]([_.-]?[a-z0-9]+)*$/
  ],
  pip: [
    /^[A-Z0-9]|[A-Z0-9][A-Z0-9._-]*[A-Z0-9]$/i
  ],
  cargo: [
    /^[a-zA-Z][a-zA-Z0-9_-]*$/
  ],
  maven: [
    /^[a-zA-Z0-9._-]+:[a-zA-Z0-9._-]+$/
  ],
  nuget: [
    /^[A-Za-z0-9._-]+$/
  ],
  gem: [
    /^[a-zA-Z0-9._-]+$/
  ],
  cocoapods: [
    /^[a-zA-Z0-9._-]+$/
  ],
  conan: [
    /^[a-zA-Z0-9._-]+$/
  ],
  cpan: [
    /^[A-Za-z0-9:_-]+$/
  ],
  cran: [
    /^[a-zA-Z0-9.]+$/
  ],
  docker_hub: [
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/,
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/
  ],
  helm: [
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/
  ],
  swift: [
    /^[a-zA-Z0-9._-]+$/
  ],
  vcpkg: [
    /^[a-z0-9-]+$/
  ]
};

export const CONTEXT_HINT_PATTERNS: ContextHintPatterns = {
  file_extensions: {
    npm: ['.js', '.ts', '.jsx', '.tsx', '.json', '.mjs', '.cjs'],
    composer: ['.php'],
    pip: ['.py', '.pyw'],
    cargo: ['.rs'],
    maven: ['.java', '.xml'],
    nuget: ['.cs', '.vb', '.fs', '.csproj', '.vbproj', '.fsproj'],
    gem: ['.rb', '.gemspec'],
    cocoapods: ['.swift', '.m', '.h', '.podspec'],
    conan: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'],
    cpan: ['.pl', '.pm', '.t'],
    cran: ['.R', '.r'],
    docker_hub: ['.dockerfile'],
    helm: ['.yaml', '.yml'],
    swift: ['.swift'],
    vcpkg: ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp']
  },
  keywords: {
    npm: ['node', 'nodejs', 'javascript', 'typescript', 'react', 'vue', 'angular', 'express', 'webpack', 'babel'],
    composer: ['php', 'laravel', 'symfony', 'drupal', 'wordpress', 'zend'],
    pip: ['python', 'django', 'flask', 'fastapi', 'pandas', 'numpy', 'scipy', 'matplotlib'],
    cargo: ['rust', 'rustlang', 'tokio', 'serde', 'actix'],
    maven: ['java', 'maven', 'spring', 'hibernate', 'junit', 'gradle'],
    nuget: ['dotnet', 'csharp', 'vb.net', 'fsharp', 'aspnet', 'entity', 'framework'],
    gem: ['ruby', 'rails', 'sinatra', 'rspec', 'bundler', 'jekyll'],
    cocoapods: ['ios', 'macos', 'swift', 'objective-c', 'xcode', 'cocoa'],
    conan: ['cpp', 'c++', 'cmake', 'gcc', 'clang', 'visual studio'],
    cpan: ['perl', 'cpan', 'metacpan', 'perl5', 'moose'],
    cran: ['r', 'rstats', 'ggplot', 'dplyr', 'shiny', 'tidyverse'],
    docker_hub: ['docker', 'container', 'dockerfile', 'compose', 'kubernetes'],
    helm: ['helm', 'kubernetes', 'k8s', 'chart', 'tiller'],
    swift: ['swift', 'swiftpm', 'ios', 'macos', 'xcode'],
    vcpkg: ['vcpkg', 'cpp', 'c++', 'visual', 'studio', 'cmake']
  },
  framework_packages: {
    npm: ['react', 'vue', 'angular', 'express', 'next', 'nuxt', 'gatsby'],
    composer: ['laravel/framework', 'symfony/symfony', 'drupal/core'],
    pip: ['django', 'flask', 'fastapi', 'tornado', 'pyramid'],
    cargo: ['tokio', 'serde', 'actix-web', 'rocket', 'warp'],
    maven: ['spring-boot', 'hibernate', 'junit', 'mockito'],
    nuget: ['Microsoft.AspNetCore', 'EntityFramework', 'Newtonsoft.Json'],
    gem: ['rails', 'sinatra', 'rspec', 'capybara'],
    cocoapods: ['Alamofire', 'SnapKit', 'RxSwift'],
    conan: ['boost', 'poco', 'protobuf'],
    cpan: ['Mojolicious', 'Catalyst', 'DBIx::Class'],
    cran: ['ggplot2', 'dplyr', 'shiny', 'knitr'],
    docker_hub: ['nginx', 'redis', 'postgres', 'mysql'],
    helm: ['ingress-nginx', 'cert-manager', 'prometheus'],
    swift: ['Alamofire', 'SnapKit', 'RxSwift'],
    vcpkg: ['boost', 'opencv', 'curl']
  }
};

export const CONFIDENCE_CALCULATION: ConfidenceCalculation = {
  weights: {
    exact_package_name_match: 0.4,
    package_name_pattern: 0.3,
    context_hints: 0.2,
    user_preference: 0.1
  },
  thresholds: {
    high_confidence: 0.8,
    medium_confidence: 0.6,
    low_confidence: 0.3
  }
};

export const PARALLEL_EXECUTION_STRATEGY: ParallelExecutionStrategy = {
  high_confidence_threshold: 0.8,
  medium_confidence_parallel_count: 3,
  low_confidence_threshold: 0.3,
  early_return_on_first_success: true,
  early_return_timeout: 2000
};