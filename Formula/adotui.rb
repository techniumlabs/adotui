class Adotui < Formula
  desc "Terminal UI for managing Azure DevOps pull requests"
  homepage "https://github.com/techniumlabs/adotui"
  version "0.1.3"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.3/adotui-macos-x64"
      sha256 "3507ec5654caf7793c7ca62de27956d33237e20602ea25256df7e238579df0f1"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.3/adotui-macos-arm64"
      sha256 "28f889597673499b7c3b6cf831107d8d23ebdd6f16ecc4476e92372542cc145c"
    end
  end

  on_linux do
    if Hardware::CPU.intel?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.3/adotui-linux-x64"
      sha256 "d28eb758e658794be3739dea0fd3083422ad6b19497e1dea3fbce3bc6d377abf"
    elsif Hardware::CPU.arm?
      url "https://github.com/techniumlabs/adotui/releases/download/v0.1.3/adotui-linux-arm64"
      sha256 "efe4a6460779d21cadd616e9d6e316c1dc4381470c15dd5ac7751063f39422ed"
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
