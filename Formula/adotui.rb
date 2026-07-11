class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.2"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.2/adotui-macos-x64"
      sha256 "95d68f7d5fbb26be98fa8dacbe63e6815740b974d31947a258acdc6710637289"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.2/adotui-macos-arm64"
      sha256 "549f53f0433daf03fa58b042e18a5492299d871fed0e13ea5f7d7a38fd1d9785"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.2/adotui-linux-x64"
      sha256 "bfc39047f95a092130796a4c97a05fb3f6791b6682a92901dc53667220471d1c"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.2/adotui-linux-arm64"
      sha256 "f071dd6fb7601addc9e97edc06618e7610d2b1432f1bd4515755853efe625382"
    end
  end

  def install
    if OS.mac? && Hardware::CPU.intel?
      bin.install "adotui-macos-x64" => "adotui"
    elsif OS.mac? && Hardware::CPU.arm?
      bin.install "adotui-macos-arm64" => "adotui"
    elsif OS.linux? && Hardware::CPU.intel?
      bin.install "adotui-linux-x64" => "adotui"
    elsif OS.linux? && Hardware::CPU.arm?
      bin.install "adotui-linux-arm64" => "adotui"
    end
  end
end
